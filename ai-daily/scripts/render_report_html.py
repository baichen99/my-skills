#!/usr/bin/env python3
"""
将日报 Markdown 渲染为单文件 HTML（零第三方依赖）。

用法:
  python render_report_html.py input.md
  python render_report_html.py input.md -o output.html
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import pathlib
import re


def inline_format(text: str) -> str:
    escaped = html.escape(text)
    # `code`
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    # [text](url)
    escaped = re.sub(
        r"\[([^\]]+)\]\((https?://[^\s)]+)\)",
        r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>',
        escaped,
    )
    return escaped


def parse_markdown(md_text: str) -> str:
    lines = md_text.splitlines()
    blocks: list[str] = []
    in_ul = False
    in_ol = False

    def close_lists() -> None:
        nonlocal in_ul, in_ol
        if in_ul:
            blocks.append("</ul>")
            in_ul = False
        if in_ol:
            blocks.append("</ol>")
            in_ol = False

    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            close_lists()
            continue

        if stripped.startswith("# "):
            close_lists()
            blocks.append(f"<h1>{inline_format(stripped[2:].strip())}</h1>")
            continue
        if stripped.startswith("## "):
            close_lists()
            blocks.append(f"<h2>{inline_format(stripped[3:].strip())}</h2>")
            continue
        if stripped.startswith("### "):
            close_lists()
            blocks.append(f"<h3>{inline_format(stripped[4:].strip())}</h3>")
            continue

        ul_match = re.match(r"^[-*]\s+(.+)$", stripped)
        if ul_match:
            if in_ol:
                blocks.append("</ol>")
                in_ol = False
            if not in_ul:
                blocks.append("<ul>")
                in_ul = True
            blocks.append(f"<li>{inline_format(ul_match.group(1).strip())}</li>")
            continue

        ol_match = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if ol_match:
            if in_ul:
                blocks.append("</ul>")
                in_ul = False
            if not in_ol:
                blocks.append("<ol>")
                in_ol = True
            blocks.append(f"<li>{inline_format(ol_match.group(2).strip())}</li>")
            continue

        close_lists()
        blocks.append(f"<p>{inline_format(stripped)}</p>")

    close_lists()
    return "\n".join(blocks)


def build_html(title: str, body: str) -> str:
    today = dt.date.today().isoformat()
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(title)}</title>
  <style>
    :root {{
      --bg: #f5f7fa;
      --panel: #ffffff;
      --text: #1c2430;
      --muted: #64748b;
      --line: #e2e8f0;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --code-bg: #f1f5f9;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --tag-bg: #dbeafe;
      --tag-text: #1e40af;
      --card-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      --card-hover-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
                   "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
    }}
    .wrap {{
      max-width: 960px;
      margin: 40px auto;
      padding: 0 20px;
    }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 40px;
      box-shadow: var(--card-shadow);
      transition: all 0.3s ease;
    }}
    .card:hover {{
      box-shadow: var(--card-hover-shadow);
    }}
    .meta {{
      color: var(--muted);
      font-size: 14px;
      margin-bottom: 20px;
      padding: 12px 16px;
      background: var(--code-bg);
      border-radius: 8px;
      display: inline-block;
    }}
    h1, h2, h3 {{
      line-height: 1.35;
      margin-top: 32px;
      margin-bottom: 16px;
      font-weight: 600;
    }}
    h1 {{
      margin-top: 0;
      font-size: 36px;
      border-bottom: 2px solid var(--primary);
      padding-bottom: 16px;
      color: #1e293b;
    }}
    h2 {{
      font-size: 26px;
      color: var(--primary);
      display: flex;
      align-items: center;
    }}
    h2::before {{
      content: "";
      width: 4px;
      height: 24px;
      background: var(--primary);
      border-radius: 2px;
      margin-right: 12px;
    }}
    h3 {{ font-size: 20px; color: #334155; }}
    p {{ margin: 12px 0; }}
    ul, ol {{
      padding-left: 24px;
      margin: 12px 0 20px;
    }}
    li {{
      margin: 8px 0;
      line-height: 1.8;
    }}
    /* 新闻列表样式 */
    ol > li {{
      background: #fafbfc;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px 22px;
      margin-bottom: 16px;
      transition: all 0.2s ease;
    }}
    ol > li:hover {{
      border-color: var(--primary);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
    }}
    /* 分类标签样式 */
    li strong:first-child,
    li b:first-child {{
      display: inline-block;
      background: var(--tag-bg);
      color: var(--tag-text);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.88em;
      font-weight: 600;
      margin-right: 8px;
      margin-bottom: 8px;
    }}
    /* 超链接样式 */
    a {{
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }}
    a:hover {{
      color: var(--primary-hover);
      border-bottom-color: var(--primary-hover);
    }}
    /* 来源链接样式 */
    li > ul > li,
    li > * > ul > li {{
      background: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 4px 0 !important;
      transform: none !important;
      box-shadow: none !important;
      font-size: 0.95em;
      color: var(--muted);
    }}
    code {{
      background: var(--code-bg);
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 0.9em;
      color: #e11d48;
    }}
    /* 失败清单样式 */
    ul:last-of-type li {{
      color: var(--danger);
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.95em;
    }}
    /* 响应式适配 */
    @media (max-width: 640px) {{
      .wrap {{
        margin: 20px auto;
        padding: 0 12px;
      }}
      .card {{
        padding: 24px;
        border-radius: 16px;
      }}
      h1 {{
        font-size: 28px;
      }}
      h2 {{
        font-size: 22px;
      }}
      ol > li {{
        padding: 14px 16px;
      }}
    }}
  </style>
</head>
<body>
  <main class="wrap">
    <article class="card">
      <div class="meta">生成日期：{today}</div>
      {body}
    </article>
  </main>
</body>
</html>
"""


def extract_title(markdown_text: str, fallback: str) -> str:
    for line in markdown_text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def main() -> None:
    parser = argparse.ArgumentParser(description="将 Markdown 日报渲染为 HTML。")
    parser.add_argument("input", help="输入 Markdown 文件路径")
    parser.add_argument(
        "-o",
        "--output",
        help="输出 HTML 文件路径（默认与输入同名 .html）",
    )
    args = parser.parse_args()

    input_path = pathlib.Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"输入文件不存在: {input_path}")

    output_path = (
        pathlib.Path(args.output).expanduser().resolve()
        if args.output
        else input_path.with_suffix(".html")
    )

    markdown_text = input_path.read_text(encoding="utf-8")
    title = extract_title(markdown_text, fallback="AI Daily Report")
    body = parse_markdown(markdown_text)
    page = build_html(title=title, body=body)

    output_path.write_text(page, encoding="utf-8")
    print(f"HTML 已生成: {output_path}")


if __name__ == "__main__":
    main()
