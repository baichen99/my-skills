#!/usr/bin/env python3
"""
封装：将语音稿 Markdown 转为同主文件名的 MP3（调用 voice_to_audio.py）。

用法（在 ai-daily 目录下）:
  python scripts/export_voice_mp3.py examples/voice-script-sample.md
  python scripts/export_voice_mp3.py path/to/info-source-voice-2026-03-30.md --plain
  python scripts/export_voice_mp3.py script.md --pause-ms 1200

`--plain`、`--pause-ms` 等会原样传给 voice_to_audio.py。
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(
        description="语音稿 .md → 同目录同名 .mp3（封装 voice_to_audio.py）",
    )
    ap.add_argument("markdown", help="语音稿 Markdown 路径")
    args, rest = ap.parse_known_args()

    md = Path(args.markdown).expanduser().resolve()
    if not md.is_file():
        print(f"文件不存在: {md}", file=sys.stderr)
        sys.exit(1)

    script_dir = Path(__file__).resolve().parent
    voice_py = script_dir / "voice_to_audio.py"
    out = md.with_suffix(".mp3")
    cmd = [sys.executable, str(voice_py), str(md), "-o", str(out), *rest]
    print("执行:", " ".join(cmd), file=sys.stderr)
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
