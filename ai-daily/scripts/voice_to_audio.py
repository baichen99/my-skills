#!/usr/bin/env python3
"""
将「语音稿」Markdown 转为可读文本，并调用火山引擎 OpenSpeech HTTP TTS（V1）生成音频。

接口与鉴权与官方文档一致：
  POST https://openspeech.bytedance.com/api/v1/tts
  Header: Authorization: Bearer;{access_token}

环境变量（推荐）：
  VOLC_TTS_APPID          控制台应用 appid
  VOLC_TTS_ACCESS_TOKEN   控制台 access_token（与文档中的 token 一致）
可选：
  VOLC_TTS_VOICE_TYPE     默认 zh_male_M392_conversation_wvae_bigtts
  VOLC_TTS_ENCODING       默认 mp3（亦支持 wav 等，见文档）
  VOLC_TTS_PAUSE_MS       语音稿内「新闻条」之间 SSML 停顿时长，默认 900

也可在 ai-daily/settings.json 中配置 volc_tts.* 或顶层 VOLC_TTS_*。

默认对含「## 正文」且正文内有多条「### …」的语音稿使用 **SSML**，在条与条之间插入 `<break time="…ms"/>`；`--plain` 可关闭。长文仍按长度切分多段请求后拼接。

用法:
  python voice_to_audio.py examples/voice-script-sample.md -o out.mp3
  python voice_to_audio.py script.md --plain
  VOLC_TTS_APPID=xxx VOLC_TTS_ACCESS_TOKEN=yyy python voice_to_audio.py script.md
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import ssl
import sys
import uuid
import urllib.error
import urllib.request
from pathlib import Path


TTS_URL = "https://openspeech.bytedance.com/api/v1/tts"
# 文档示例音色（大模型相关 bigtts）；可按控制台授权替换
DEFAULT_VOICE = "zh_male_M392_conversation_wvae_bigtts"
CHUNK_CHAR_LIMIT = 480


def _tts_error_hint(err_body: str) -> str:
    """根据服务端 JSON 补充控制台侧排查说明（不修改原始错误信息）。"""
    try:
        o = json.loads(err_body)
    except json.JSONDecodeError:
        return ""
    code = o.get("code")
    msg = str(o.get("message", ""))
    if code != 3001 or "not granted" not in msg:
        return ""
    if "seedtts" in msg.lower():
        return (
            "\n---\n"
            "【说明】该错误表示当前应用/账号尚未开通或未授权「语音合成大模型（Seed TTS）」资源。\n"
            "请到火山引擎控制台 → 豆包语音 → 为应用开通「语音合成大模型」并完成授权；"
            "或暂时改用控制台已授权的传统音色，例如：\n"
            "  python scripts/voice_to_audio.py ... --voice zh_male_M392_conversation_wvae_bigtts\n"
            "（若仍报未授权，请在控制台核对音色是否已下单/授权。）\n"
            "产品文档：https://www.volcengine.com/docs/6561/1257543"
        )
    return (
        "\n---\n"
        "【说明】请在本机火山引擎控制台为当前应用开通豆包「语音合成」相关能力并授权后再试。\n"
    )


def load_settings(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


# 仅作章节标题、无实际语义，避免被 TTS 读出来
_SECTION_TITLES = frozenset({"正文", "开场白", "收尾", "元信息"})


def _xml_escape_text(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _block_lines_to_plain(lines: list[str]) -> str:
    out: list[str] = []
    for line in lines:
        s = line.strip()
        if not s or s == "---":
            continue
        if s.startswith(">"):
            continue
        if s.startswith("#"):
            s = re.sub(r"^#+\s*", "", s)
        if s in _SECTION_TITLES:
            continue
        s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
        s = s.replace("*", "").replace("`", "")
        if s:
            out.append(s)
    t = " ".join(out)
    return re.sub(r"\s+", " ", t).strip()


def voice_md_to_ssml_chunks(
    md: str,
    pause_ms: int,
    chunk_limit: int = CHUNK_CHAR_LIMIT,
) -> list[str] | None:
    """
    若「## 正文」含「### …」分条，且开场/各条/收尾合并后至少 **2 段可读文本**，
    则生成带 `<break time="…ms"/>` 的 SSML，并拆成若干 <speak> 片段。
    否则返回 None，调用方应使用 voice_md_to_plain。
    """
    if "## 附录" in md:
        work = md.split("## 附录", 1)[0]
    else:
        work = md
    if "## 开场白" in work:
        after_open = work.split("## 开场白", 1)[1]
    else:
        after_open = re.sub(r"^#\s+.*\n+", "", work, count=1, flags=re.MULTILINE)

    opening = ""
    body = ""
    closing = ""
    if "## 正文" in after_open:
        opening = after_open.split("## 正文", 1)[0].strip()
        body_and_rest = after_open.split("## 正文", 1)[1]
    else:
        body_and_rest = after_open
        opening = ""

    if "## 收尾" in body_and_rest:
        body = body_and_rest.split("## 收尾", 1)[0].strip()
        closing = body_and_rest.split("## 收尾", 1)[1].strip()
        if "##" in closing:
            closing = closing.split("##", 1)[0].strip()
    else:
        body = body_and_rest.strip()

    if "###" not in body:
        return None
    raw_subs = re.split(r"\n(?=###\s)", body.strip())
    subs: list[str] = []
    for raw in raw_subs:
        raw = raw.strip()
        if not raw:
            continue
        lines = raw.splitlines()
        if lines and re.match(r"^#+\s*", lines[0]):
            lines = lines[1:]
        txt = _block_lines_to_plain(lines)
        if txt:
            subs.append(txt)

    segs: list[str] = []
    if opening:
        op = _block_lines_to_plain(opening.splitlines())
        if op:
            segs.append(_xml_escape_text(op))
    segs.extend(_xml_escape_text(s) for s in subs)
    if closing:
        cl = _block_lines_to_plain(closing.splitlines())
        if cl:
            segs.append(_xml_escape_text(cl))

    if len(segs) < 2:
        return None

    brk = f'<break time="{pause_ms}ms"/>'
    inner = segs[0]
    for s in segs[1:]:
        inner += brk + s
    speak = f"<speak>{inner}</speak>"
    return _pack_speak_chunks(speak, chunk_limit)


def _pack_speak_chunks(speak: str, limit: int) -> list[str]:
    """将长 SSML 按 <break> 边界拆成多段完整 <speak>…</speak>。"""
    if len(speak) <= limit:
        return [speak]
    inner = speak[len("<speak>") : -len("</speak>")]
    parts = re.split(r'(<break time="\d+ms"/>)', inner)
    packed: list[str] = []
    cur = "<speak>"
    for p in parts:
        if not p:
            continue
        if len(cur) + len(p) + len("</speak>") > limit and cur != "<speak>":
            packed.append(cur + "</speak>")
            cur = "<speak>" + p
        else:
            cur += p
    if cur != "<speak>":
        packed.append(cur + "</speak>")
    return packed if packed else [speak]


def voice_md_to_plain(md: str) -> str:
    """保留开场白～收尾；丢弃附录。"""
    block = md
    if "## 附录" in block:
        block = block.split("## 附录", 1)[0]
    if "## 开场白" in block:
        block = block.split("## 开场白", 1)[1]
    else:
        block = re.sub(r"^#\s+.*\n+", "", block, count=1, flags=re.MULTILINE)

    lines_out: list[str] = []
    for line in block.splitlines():
        s = line.strip()
        if not s or s == "---":
            continue
        if s.startswith(">"):
            continue
        if s.startswith("#"):
            s = re.sub(r"^#+\s*", "", s)
        if s in _SECTION_TITLES:
            continue
        s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
        s = s.replace("*", "").replace("`", "")
        if s:
            lines_out.append(s)
    low = " ".join(lines_out)
    low = re.sub(r"\s+", " ", low)
    return low.strip()


def split_for_tts(text: str, limit: int = CHUNK_CHAR_LIMIT) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return [text]
    parts: list[str] = []
    buf = ""
    for seg in re.split(r"(?<=[。！？!?；;\n])", text):
        if not seg:
            continue
        if len(buf) + len(seg) <= limit:
            buf += seg
        else:
            if buf:
                parts.append(buf.strip())
            buf = seg
            while len(buf) > limit:
                parts.append(buf[:limit])
                buf = buf[limit:]
    if buf.strip():
        parts.append(buf.strip())
    return [p for p in parts if p]


def tts_chunk(
    appid: str,
    token: str,
    text: str,
    voice_type: str,
    encoding: str,
    uid: str = "ai-daily",
    use_ssml: bool = False,
) -> bytes:
    req_obj: dict = {
        "reqid": str(uuid.uuid4()),
        "text": text,
        "operation": "query",
    }
    if use_ssml:
        req_obj["text_type"] = "ssml"
    body = {
        "app": {
            "appid": appid,
            "token": token,
            "cluster": "volcano_tts",
        },
        "user": {"uid": uid},
        "audio": {
            "voice_type": voice_type,
            "encoding": encoding,
            "speed_ratio": 1.0,
        },
        "request": req_obj,
    }
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer;{token}",
            "Content-Type": "application/json",
            "Accept": "*/*",
            "User-Agent": "ai-daily-voice_to_audio/1.0",
        },
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        hint = _tts_error_hint(err_body)
        raise RuntimeError(f"HTTP {e.code}: {err_body}{hint}") from e
    obj = json.loads(raw.decode("utf-8"))
    code = obj.get("code")
    if code != 3000:
        msg = obj.get("message", raw.decode("utf-8", errors="replace"))
        body_txt = json.dumps(obj, ensure_ascii=False)
        hint = _tts_error_hint(body_txt)
        raise RuntimeError(f"TTS 错误 code={code}: {msg}{hint}")
    b64 = obj.get("data")
    if not b64:
        raise RuntimeError("响应无音频 data")
    return base64.b64decode(b64)


def concat_audio(chunks: list[bytes], encoding: str) -> bytes:
    if not chunks:
        return b""
    if encoding.lower() == "wav" and len(chunks) > 1:
        return _concat_wav(chunks)
    return b"".join(chunks)


def _concat_wav(chunks: list[bytes]) -> bytes:
    import wave
    import io

    first = io.BytesIO(chunks[0])
    with wave.open(first, "rb") as w0:
        params = w0.getparams()
        frames = [w0.readframes(w0.getnframes())]
    for c in chunks[1:]:
        bio = io.BytesIO(c)
        with wave.open(bio, "rb") as w:
            if w.getparams() != params:
                raise ValueError("WAV 参数不一致，无法拼接")
            frames.append(w.readframes(w.getnframes()))
    out = io.BytesIO()
    with wave.open(out, "wb") as wo:
        wo.setparams(params)
        for f in frames:
            wo.writeframes(f)
    return out.getvalue()


def main() -> None:
    ap = argparse.ArgumentParser(description="语音稿 Markdown → 火山 OpenSpeech TTS 音频")
    ap.add_argument("input", help="语音稿 .md 路径")
    ap.add_argument(
        "-o",
        "--output",
        help="输出音频路径（默认与输入同目录，扩展名 .mp3）",
    )
    ap.add_argument("--voice", help="音色 voice_type，默认环境变量或内置默认")
    ap.add_argument(
        "--encoding",
        default=None,
        help="音频编码；不传则依次读环境变量、settings.json，默认 mp3",
    )
    ap.add_argument(
        "--plain",
        action="store_true",
        help="禁用 SSML，整稿按纯文本切分合成（无条间停顿）",
    )
    ap.add_argument(
        "--pause-ms",
        type=int,
        default=None,
        help="SSML 条间停顿毫秒，默认 900 或环境变量 VOLC_TTS_PAUSE_MS",
    )
    args = ap.parse_args()

    in_path = Path(args.input).expanduser().resolve()
    if not in_path.exists():
        print(f"文件不存在: {in_path}", file=sys.stderr)
        sys.exit(1)

    root = Path(__file__).resolve().parents[1]
    settings = load_settings(root / "settings.json")
    vt = settings.get("volc_tts") or {}

    def _env_or_flat(name: str) -> str:
        v = os.environ.get(name)
        if v is not None and str(v).strip():
            return str(v).strip()
        fv = settings.get(name)
        if fv is not None and str(fv).strip():
            return str(fv).strip()
        return ""

    def _nested(*keys: str) -> str:
        if not isinstance(vt, dict):
            return ""
        for k in keys:
            nv = vt.get(k)
            if nv is not None and str(nv).strip():
                return str(nv).strip()
        return ""

    appid = _env_or_flat("VOLC_TTS_APPID") or _nested("appid")
    token = _env_or_flat("VOLC_TTS_ACCESS_TOKEN") or _nested(
        "access_token", "accessToken"
    )
    voice = (
        args.voice
        or _env_or_flat("VOLC_TTS_VOICE_TYPE")
        or _nested("voice_type")
        or DEFAULT_VOICE
    )
    encoding = (
        args.encoding
        or _env_or_flat("VOLC_TTS_ENCODING")
        or _nested("encoding")
        or "mp3"
    )
    pause_ms = args.pause_ms
    if pause_ms is None:
        ps = _env_or_flat("VOLC_TTS_PAUSE_MS") or _nested("pause_ms")
        pause_ms = int(ps) if ps and str(ps).strip().isdigit() else 900

    if not appid or not token:
        print(
            "请设置 VOLC_TTS_APPID 与 VOLC_TTS_ACCESS_TOKEN（环境变量，或 ai-daily/settings.json 顶层字段 / volc_tts 嵌套）。\n"
            "获取方式见：https://www.volcengine.com/docs/6561/163043 与 API Key 说明 https://www.volcengine.com/docs/6561/1816214",
            file=sys.stderr,
        )
        sys.exit(2)

    md = in_path.read_text(encoding="utf-8")
    use_ssml = not args.plain
    ssml_chunks: list[str] | None = None
    if use_ssml:
        ssml_chunks = voice_md_to_ssml_chunks(md, pause_ms=pause_ms)

    if ssml_chunks:
        print(
            f"使用 SSML 合成（条间停顿 {pause_ms}ms），共 {len(ssml_chunks)} 段 …",
            file=sys.stderr,
        )
        chunks_text = ssml_chunks
        use_ssml_flag = True
    else:
        plain = voice_md_to_plain(md)
        if not plain:
            print("未能从 Markdown 提取可读文本", file=sys.stderr)
            sys.exit(1)
        chunks_text = split_for_tts(plain)
        use_ssml_flag = False

    audio_parts: list[bytes] = []
    for i, piece in enumerate(chunks_text):
        print(f"合成片段 {i + 1}/{len(chunks_text)}，长度 {len(piece)} …", file=sys.stderr)
        audio_parts.append(
            tts_chunk(appid, token, piece, voice, encoding, use_ssml=use_ssml_flag)
        )

    blob = concat_audio(audio_parts, encoding)
    if not blob:
        blob = b"".join(audio_parts)

    out = (
        Path(args.output).expanduser().resolve()
        if args.output
        else in_path.with_suffix("." + encoding.lower().split("_")[0])
    )
    out.write_bytes(blob)
    print(f"已写入: {out} ({len(blob)} bytes)")


if __name__ == "__main__":
    main()
