#!/usr/bin/env python3
"""
从「结构化日报」Markdown 生成**博客/播客向口播稿**（单独文件），不用于直接朗读原日报。

特点：
  - 正文中不出现任何 URL、Markdown 链接、来源行；
  - 按「开场 → 分条正文 → 收尾」组织，条与条带口语过渡；
  - 输出格式兼容 voice_to_audio.py 的 SSML 分条（## 正文 + ### 第 N 条）；
  - 链接仅出现在文末「附录」，供剪辑或简介使用，不进入 TTS。

用法:
  python daily_to_blog_voice.py ai-daily-frontend-2026-03-30.md
  python daily_to_blog_voice.py report.md -o custom-name.md --audio

依赖：仅 Python 标准库。
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


_URL = re.compile(r"https?://[^\s\)\]>\u4e00-\u9fff]+|https?://\S+")
_MD_LINK = re.compile(r"\[([^\]]*)\]\([^)]+\)")
_ITEM_HEAD = re.compile(
    r"^(\d+)\.\s*【([^】]+)】\s*(.*)$",
    re.DOTALL,
)


def _strip_urls(s: str) -> str:
    s = _MD_LINK.sub(r"\1", s)
    s = _URL.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def _drop_meta_lines(block: str) -> str:
    """去掉 原文/来源 等行，保留正文叙述。"""
    lines_out: list[str] = []
    for line in block.splitlines():
        t = line.strip()
        if not t:
            continue
        if re.match(r"^-\s*原文[：:]", t):
            continue
        if re.match(r"^-\s*来源[：:]", t):
            continue
        if re.match(r"^原文[：:]", t):
            continue
        if re.match(r"^来源[：:]", t):
            continue
        lines_out.append(line)
    return "\n".join(lines_out)


def _parse_title_date(md: str) -> tuple[str, str | None]:
    m = re.search(r"^#\s+(.+)$", md, re.MULTILINE)
    if not m:
        return "今日播报", None
    title = m.group(1).strip()
    dm = re.search(r"(\d{4}-\d{2}-\d{2})", title)
    return title, dm.group(1) if dm else None


def _parse_section(md: str, name: str) -> str:
    pat = rf"(?ms)^##\s+{re.escape(name)}\s*\n(.*?)(?=^##\s|\Z)"
    m = re.search(pat, md)
    return m.group(1).strip() if m else ""


def _parse_focus_bullets(block: str) -> dict[str, str]:
    """从「今日重点」里抽主题、条数等（无链接）。"""
    out: dict[str, str] = {}
    for line in block.splitlines():
        line = line.strip()
        if not line.startswith("-"):
            continue
        line = line.lstrip("-").strip()
        for key, label in (
            ("主题聚焦", "theme"),
            ("主题", "theme"),
            ("覆盖来源", "sources"),
            ("条目总数", "count"),
        ):
            if line.startswith(key):
                rest = line.split("：", 1)[-1].split(":", 1)[-1].strip()
                out[label] = _strip_urls(rest)
    return out


def _parse_news_items(md: str) -> tuple[list[dict], list[dict]]:
    """
    返回 (items_for_voice, items_for_appendix)
    items: idx, category, body_plain, url?, source?
    """
    section = _parse_section(md, "今日资讯")
    if not section:
        return [], []

    # 按「数字. 」切分条目（第一条前可能无换行）
    chunks = re.split(r"\n(?=\d+\.\s*【)", "\n" + section)
    chunks = [c.strip() for c in chunks if c.strip()]

    voice_items: list[dict] = []
    appendix_rows: list[dict] = []

    for ch in chunks:
        m = _ITEM_HEAD.match(ch.strip())
        if not m:
            continue
        idx_s, category, rest = m.group(1), m.group(2), m.group(3)
        idx = int(idx_s)
        body_block = _drop_meta_lines(rest)
        url = ""
        src = ""
        for line in rest.splitlines():
            t = line.strip()
            um = re.search(r"原文[：:]\s*(\S+)", t)
            if um:
                url = um.group(1).strip()
            sm = re.search(r"来源[：:]\s*(.+)", t)
            if sm:
                src = sm.group(1).strip()

        body_plain = _strip_urls(body_block)
        voice_items.append(
            {"idx": idx, "category": category, "body": body_plain}
        )
        appendix_rows.append(
            {
                "idx": idx,
                "category": category,
                "title_hint": body_plain[:40] + ("…" if len(body_plain) > 40 else ""),
                "url": url,
                "source": src,
            }
        )

    voice_items.sort(key=lambda x: x["idx"])
    appendix_rows.sort(key=lambda x: x["idx"])
    return voice_items, appendix_rows


def _bullets_to_sentences(block: str, max_bullets: int = 6) -> list[str]:
    lines: list[str] = []
    for line in block.splitlines():
        t = line.strip()
        if t.startswith("-"):
            t = t.lstrip("-").strip()
            t = _strip_urls(t)
            if t:
                lines.append(t)
    return lines[:max_bullets]


# 第 2 条起的口语过渡（轮换；第 1 条单独用「先聊『分类』」）
_TRANS = [
    "接着说，",
    "下一条。",
    "再往后面看。",
    "还有一条值得说说。",
    "继续往下。",
    "再看一条。",
    "另外，",
    "最后这条也很有意思。",
]


def _oral_item_transition(i: int, n: int) -> str:
    if i == 0:
        return ""
    return _TRANS[(i - 1) % len(_TRANS)]


def build_blog_voice_md(
    md: str,
    show_name: str = "本期节目",
) -> str:
    title, date = _parse_title_date(md)
    focus = _parse_section(md, "今日重点")
    meta = _parse_focus_bullets(focus)
    items, appendix = _parse_news_items(md)
    summary_block = _parse_section(md, "今日总结")
    future_block = _parse_section(md, "未来展望")

    theme = meta.get("theme", "")
    sources = meta.get("sources", "")
    count = meta.get("count", str(len(items)))

    short_title = re.sub(r"\s*[-–]\s*\d{4}-\d{2}-\d{2}\s*$", "", title).strip()

    # --- 开场白（无链接、短句）---
    date_phrase = f"{date}，" if date else ""
    intro_parts = [
        f"嗨，欢迎收听{show_name}。{date_phrase}我是你的播报员。",
        f"今天这期围绕「{short_title}」",
    ]
    if theme:
        intro_parts.append(f"重点看：{theme}。")
    elif sources:
        intro_parts.append(f"信息主要来自：{sources}。")
    intro_parts.append(f"一共整理了 {count} 条，我们一条条说。")
    opening = " ".join(intro_parts)

    # --- 正文分条 ---
    body_sections: list[str] = []
    for i, it in enumerate(items):
        trans = _oral_item_transition(i, len(items))
        cat = it["category"]
        raw = it["body"]
        if i == 0:
            para = f"先聊「{cat}」。{raw}"
        else:
            para = f"{trans}{raw}" if trans else raw
        body_sections.append(para)

    # --- 收尾：总结 + 展望，口语化 ---
    closing_bits: list[str] = []
    closing_bits.append("好，资讯部分先到这儿。")
    sums = _bullets_to_sentences(summary_block)
    if sums:
        closing_bits.append(
            "做个小结：" + "。".join(sums) + ("。" if sums[-1][-1] not in "。！？" else "")
        )
    fut = _bullets_to_sentences(future_block, max_bullets=4)
    if fut:
        closing_bits.append("往后值得盯的方向包括：" + "；".join(fut) + "。")
    closing_bits.append("感谢收听，我们下期见。")
    closing = " ".join(closing_bits) if len(closing_bits) > 1 else "感谢收听，我们下期见。"

    # --- 拼装 Markdown ---
    lines: list[str] = [
        f"# {short_title} · 口播稿",
        "",
        "## 元信息",
        f"- **主题**：{_strip_urls(theme or title)}",
        f"- **条数**：{count}",
        "",
        "## 开场白",
        "",
        opening,
        "",
        "## 正文",
        "",
    ]

    for i, para in enumerate(body_sections):
        lines.append(f"### 第{_chinese_num(i + 1)}条")
        lines.append("")
        lines.append(para)
        lines.append("")

    lines.extend(
        [
            "## 收尾",
            "",
            closing,
            "",
            "## 附录：链接与出处",
            "",
            "> 以下不进入朗读；供发布博客、简介或字幕引用。",
            "",
        ]
    )

    for row in appendix:
        url = row["url"] or "（未抓取到链接）"
        src = row["source"] or ""
        hint = row["title_hint"].replace("\n", " ")
        line = f"{row['idx']}. 【{row['category']}】{hint}"
        if src:
            line += f" — 来源：{src}"
        line += f" — {url}"
        lines.append(line)

    return "\n".join(lines).rstrip() + "\n"


def _chinese_num(n: int) -> str:
    if n <= 0:
        return str(n)
    m = "一二三四五六七八九十"
    if 1 <= n <= 10:
        return m[n - 1]
    if n < 20:
        return "十" + (m[n - 11] if n > 10 else "")
    if n % 10 == 0 and n < 100:
        return m[n // 10 - 1] + "十"
    return str(n)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="结构化日报 → 博客向口播稿（无朗读链接），可选导出 MP3",
    )
    ap.add_argument("daily_md", help="日报 .md 路径，如 ai-daily-frontend-2026-03-30.md")
    ap.add_argument(
        "-o",
        "--output",
        help="输出口播稿路径；默认与日报同目录，文件名加 -blog-voice.md",
    )
    ap.add_argument(
        "--show-name",
        default="本期节目",
        help="开场白中的节目名，默认「本期节目」",
    )
    ap.add_argument(
        "--audio",
        action="store_true",
        help="生成口播稿后自动调用 export_voice_mp3.py 生成同名 .mp3",
    )
    args = ap.parse_args()

    src = Path(args.daily_md).expanduser().resolve()
    if not src.is_file():
        print(f"文件不存在: {src}", file=sys.stderr)
        sys.exit(1)

    raw = src.read_text(encoding="utf-8")
    out_text = build_blog_voice_md(raw, show_name=args.show_name)

    out_path = (
        Path(args.output).expanduser().resolve()
        if args.output
        else src.with_name(src.stem + "-blog-voice.md")
    )
    out_path.write_text(out_text, encoding="utf-8")
    print(f"已写入口播稿: {out_path}", file=sys.stderr)

    if args.audio:
        print(
            "提示：已将 --audio 用于一键合成。技能推荐流程是先审阅文字稿再单独运行 export_voice_mp3.py。",
            file=sys.stderr,
        )
        exporter = Path(__file__).resolve().parent / "export_voice_mp3.py"
        rc = subprocess.call(
            [sys.executable, str(exporter), str(out_path)],
        )
        raise SystemExit(rc)


if __name__ == "__main__":
    main()
