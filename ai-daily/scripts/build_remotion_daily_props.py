#!/usr/bin/env python3
"""
从“日报 Markdown + 本次生成的音频目录”构建 Remotion daily.json props。

输入（必须）：
- report-md：`ai-daily-<topic>-YYYY-MM-DD.md`
  其中 `## 今日资讯` 的每条应是单行：
  `序号.【分类】新闻描述 [原文](URL)`
- audio-dir：`opening.mp3`、`ending.mp3`、`news-1.mp3...news-N.mp3`

输出：
- out-json：daily.json（放在 runs/<runId>/ 下）

注意：
- Remotion 当前实现会显示 news.title + news.summary + category/source/publishTime
- 报道模板没有显式 title 字段，因此本脚本把“新闻描述的第一句/前半段”当作 title
- 为了避免 remotion 时长要求与帧精度问题，本脚本使用 ffprobe 得到音频时长，并将 duration 向上取整为整数秒。
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse


def _read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def _safe_filename(s: str) -> str:
    s = s.strip()
    s = re.sub(r"[^a-zA-Z0-9._-]+", "-", s)
    s = s.strip("-")
    return s or "item"


def _ffprobe_duration_s(mp3_path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nk=1:nw=1",
        str(mp3_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {mp3_path}: {r.stderr.strip()}")
    s = (r.stdout or "").strip()
    return float(s)


def _audio_data_uri(mp3_path: Path) -> str:
    b = mp3_path.read_bytes()
    b64 = base64.b64encode(b).decode("ascii")
    return f"data:audio/mpeg;base64,{b64}"


def _extract_date_from_report(report_md: str) -> str | None:
    m = re.search(r"^#\s+信息源日报\s+-\s+(\d{4}-\d{2}-\d{2})\s*$", report_md, flags=re.MULTILINE)
    if m:
        return m.group(1)
    return None


def _parse_today_news_lines(report_md: str) -> List[Dict[str, str]]:
    """
    从 `## 今日资讯` 区块解析每条（单行）：
    `1. 【分类】新闻描述 [原文](URL)`
    """
    # 找今日资讯起点
    m = re.search(r"^##\s+今日资讯\s*$", report_md, flags=re.MULTILINE)
    if not m:
        raise SystemExit("未找到 `## 今日资讯` 区块")
    start = m.end()
    # 找下一个二级标题
    m2 = re.search(r"^##\s+.+$", report_md[start:], flags=re.MULTILINE)
    end = start + (m2.start() if m2 else len(report_md) - start)
    block = report_md[start:end].strip()

    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    items: List[Dict[str, str]] = []
    # 1. 【分类】描述 [原文](URL)
    pat = re.compile(r"^(\d+)\.\s*【([^】]+)】(.*?)\s+\[原文\]\(([^)]+)\)\s*$")

    for ln in lines:
        m3 = pat.match(ln)
        if not m3:
            # 容错：有时可能是 `[...]` 文字不是“原文”
            m4 = re.match(r"^(\d+)\.\s*【([^】]+)】(.*?)\s+\[([^\]]+)\]\(([^)]+)\)\s*$", ln)
            if not m4:
                raise SystemExit(f"无法解析今日资讯行（请确保单行格式正确）：{ln}")
            idx = m4.group(1)
            cat = m4.group(2)
            desc = m4.group(3)
            url = m4.group(5)
        else:
            idx = m3.group(1)
            cat = m3.group(2)
            desc = m3.group(3)
            url = m3.group(4)

        items.append({"idx": idx, "category": cat, "description": desc.strip(), "url": url.strip()})

    # 按 idx 排序（避免偶发打乱）
    items.sort(key=lambda x: int(x["idx"]))
    return items


def _title_from_description(desc: str, max_len: int = 42) -> str:
    s = desc.strip()
    # 第一句优先
    m = re.split(r"[。！？!?；;]", s, maxsplit=1)
    if m and m[0].strip():
        cand = m[0].strip()
    else:
        cand = s
    cand = cand.strip()
    if len(cand) > max_len:
        cand = cand[:max_len].rstrip()
    return cand or "新闻要点"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report-md", required=True, help="日报 markdown 路径（包含今日资讯）")
    ap.add_argument("--audio-dir", required=True, help="音频目录（opening.mp3/ending.mp3/news-*.mp3）")
    ap.add_argument("--out-json", required=True, help="输出 daily.json 路径")
    ap.add_argument("--date", required=False, default=None, help="可选：日期 YYYY-MM-DD（未传则从 report.md header 解析）")
    args = ap.parse_args()

    report_md_path = Path(args.report_md).expanduser().resolve()
    audio_dir = Path(args.audio_dir).expanduser().resolve()
    out_json_path = Path(args.out_json).expanduser().resolve()

    if not report_md_path.exists():
        raise SystemExit(f"report md not found: {report_md_path}")
    if not audio_dir.exists():
        raise SystemExit(f"audio dir not found: {audio_dir}")

    report_md = _read_text(report_md_path)
    date_str = args.date or _extract_date_from_report(report_md)
    if not date_str:
        raise SystemExit("无法从 report.md 解析日期；请显式传 --date YYYY-MM-DD")

    opening_mp3 = audio_dir / "opening.mp3"
    ending_mp3 = audio_dir / "ending.mp3"
    if not opening_mp3.exists():
        raise SystemExit(f"missing opening mp3: {opening_mp3}")
    if not ending_mp3.exists():
        raise SystemExit(f"missing ending mp3: {ending_mp3}")

    today_news = _parse_today_news_lines(report_md)
    if not today_news:
        raise SystemExit("今日资讯解析为空")

    opening_dur = _ffprobe_duration_s(opening_mp3)
    ending_dur = _ffprobe_duration_s(ending_mp3)

    news_out: List[Dict[str, Any]] = []
    for i, item in enumerate(today_news, start=1):
        news_mp3 = audio_dir / f"news-{i}.mp3"
        if not news_mp3.exists():
            raise SystemExit(f"missing news audio: {news_mp3} (expected for i={i})")
        dur = _ffprobe_duration_s(news_mp3)

        url = item["url"]
        parsed = urlparse(url)
        host = (parsed.hostname or "").replace("www.", "")
        source = host or item["category"]

        desc = item["description"]
        title = _title_from_description(desc)

        # publishTime 本次从日报里无法得知；Remotion 字段可留空
        publish_time = ""

        news_out.append(
            {
                "id": f"{i}-{_safe_filename(title)[:40]}",
                "title": title,
                "summary": desc,
                "category": item["category"],
                "source": source,
                "publishTime": publish_time,
                "audio": _audio_data_uri(news_mp3),
                "duration": int(max(2.0, math.ceil(dur))),
            }
        )

    daily_json: Dict[str, Any] = {
        "date": date_str,
        "title": "AI 日报",
        "subtitle": "聚焦AI领域最新动态",
        "news": news_out,
        "backgroundAudio": _audio_data_uri(opening_mp3),
        "openingDuration": int(max(2.0, math.ceil(opening_dur))),
        "endingAudio": _audio_data_uri(ending_mp3),
        "endingDuration": int(max(2.0, math.ceil(ending_dur))),
        # theme 不强制提供；Remotion schema 会用默认浅色主题
    }

    out_json_path.parent.mkdir(parents=True, exist_ok=True)
    out_json_path.write_text(json.dumps(daily_json, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[BuildProps] wrote: {out_json_path}")


if __name__ == "__main__":
    main()

