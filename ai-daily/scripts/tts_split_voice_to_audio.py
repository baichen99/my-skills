#!/usr/bin/env python3
"""
把“口播文字稿”拆成开场/每条新闻/收尾，并分别调用 voice_to_audio.py 生成 MP3。

为什么要拆：
- Remotion 需要 openingAudio + 每条 news.audio + endingAudio（而不是一整个 mp3）。

输入：
- voice script md（建议结构类似：
  # xxx
  ## 开场白
  ...
  ## 正文
  ### 第一条
  ...
  ### 第二条
  ...
  ## 收尾
  ...
）

输出：
- out-dir/
  - opening.mp3
  - news-1.mp3, news-2.mp3, ...
  - ending.mp3
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from typing import Dict, List, Tuple


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _extract_section(md: str, header: str) -> str | None:
    """
    提取以 `## <header>` 开头的段落，直到下一个 `## ` 同级标题或文末。
    """
    # header 形如 "开场白" / "正文" / "收尾"
    m = re.search(rf"^##\s+{re.escape(header)}\s*$", md, flags=re.MULTILINE)
    if not m:
        return None
    start = m.end()
    m2 = re.search(r"^##\s+.+$", md[start:], flags=re.MULTILINE)
    end = start + (m2.start() if m2 else len(md) - start)
    return md[start:end].strip()


def _extract_body_news(md: str) -> List[str]:
    """
    从 `## 正文` 内按 `### ...` 拆成多条文本段。
    返回每条（去掉标题行本身）。
    """
    body = _extract_section(md, "正文")
    if not body:
        return []

    # 用 `###` 分段；标题行不参与 TTS 文本
    parts = re.split(r"^###\s+.+$", body, flags=re.MULTILINE)
    # split 会丢失标题，因此需要同时剔除空段
    segments = [p.strip() for p in parts if p.strip()]
    return segments


def _prepare_tmp_md(tmp_dir: Path, title: str, text: str) -> Path:
    p = tmp_dir / f"{title}.md"
    # voice_to_audio --plain 会丢弃首行标题；我们只放正文，避免 TTS 读出“第一条”
    _write_text(p, f"# {title}\n\n{text.strip()}\n")
    return p


def run_voice_to_audio(voice_md: Path, out_mp3: Path, pause_ms: int | None = None) -> None:
    script = Path(__file__).parent / "voice_to_audio.py"
    cmd: List[str] = [sys.executable, str(script), str(voice_md), "-o", str(out_mp3), "--plain"]
    if pause_ms is not None:
        # --plain 禁用 SSML；pause-ms 对 pure text 可能无意义，但保留接口可控
        cmd.extend(["--pause-ms", str(pause_ms)])

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"voice_to_audio failed: {r.stderr.strip() or r.stdout.strip()}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("voice_md", help="口播文字稿 .md 路径（含 开场白/正文/收尾）")
    ap.add_argument("--out-dir", required=True, help="输出目录（存放 opening/news-*/ending.mp3）")
    ap.add_argument("--pause-ms", type=int, default=None, help="可选：兼容参数（在 --plain 模式下通常无效）")
    args = ap.parse_args()

    voice_md_path = Path(args.voice_md).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    if not voice_md_path.exists():
        raise SystemExit(f"voice md not found: {voice_md_path}")

    md = _read_text(voice_md_path)
    opening = _extract_section(md, "开场白") or ""
    ending = _extract_section(md, "收尾") or ""
    news_segments = _extract_body_news(md)

    if not opening.strip():
        print("[Warn] 开场白段落为空或缺失，将仍尝试合成空文本（可能失败）。", file=sys.stderr)
    if not news_segments:
        raise SystemExit("未能从 `## 正文` 中解析到任意 `###` 新闻分段。请检查模板。")
    if not ending.strip():
        print("[Warn] 收尾段落为空或缺失，将仍尝试合成空文本（可能失败）。", file=sys.stderr)

    out_dir.mkdir(parents=True, exist_ok=True)
    opening_mp3 = out_dir / "opening.mp3"
    ending_mp3 = out_dir / "ending.mp3"

    with tempfile.TemporaryDirectory(prefix="ai-daily-tts-") as td:
        tmp_dir = Path(td)
        # Opening
        opening_tmp = _prepare_tmp_md(tmp_dir, "opening", opening)
        print(f"[TTS] opening -> {opening_mp3}")
        run_voice_to_audio(opening_tmp, opening_mp3, pause_ms=args.pause_ms)

        # News
        for i, seg in enumerate(news_segments, start=1):
            news_tmp = _prepare_tmp_md(tmp_dir, f"news-{i}", seg)
            mp3p = out_dir / f"news-{i}.mp3"
            print(f"[TTS] news {i} -> {mp3p}")
            run_voice_to_audio(news_tmp, mp3p, pause_ms=args.pause_ms)

        # Ending
        ending_tmp = _prepare_tmp_md(tmp_dir, "ending", ending)
        print(f"[TTS] ending -> {ending_mp3}")
        run_voice_to_audio(ending_tmp, ending_mp3, pause_ms=args.pause_ms)


if __name__ == "__main__":
    main()

