#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const ORDERED_ITEM_RE = /^(\d+)\.\s+(.*)$/;
const UNORDERED_ITEM_RE = /^[-*]\s+(.*)$/;

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(text: string): string {
  let out = esc(text);
  out = out.replace(INLINE_CODE_RE, (_, c1: string) => `<code>${esc(c1)}</code>`);
  out = out.replace(
    LINK_RE,
    (_, t: string, u: string) =>
      `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`
  );
  return out;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inOl = false;
  let inUl = false;
  const closeLists = () => {
    if (inOl) out.push("</ol>");
    if (inUl) out.push("</ul>");
    inOl = false;
    inUl = false;
  };

  for (const raw of lines) {
    const s = raw.trim();
    if (!s) {
      closeLists();
      continue;
    }
    if (s.startsWith("### ")) {
      closeLists();
      out.push(`<h3>${renderInline(s.slice(4))}</h3>`);
      continue;
    }
    if (s.startsWith("## ")) {
      closeLists();
      out.push(`<h2>${renderInline(s.slice(3))}</h2>`);
      continue;
    }
    if (s.startsWith("# ")) {
      closeLists();
      out.push(`<h1>${renderInline(s.slice(2))}</h1>`);
      continue;
    }
    const m1 = s.match(ORDERED_ITEM_RE);
    if (m1) {
      if (!inOl) {
        if (inUl) out.push("</ul>");
        out.push("<ol>");
        inOl = true;
        inUl = false;
      }
      out.push(`<li value="${Number(m1[1])}">${renderInline(m1[2])}</li>`);
      continue;
    }
    const m2 = s.match(UNORDERED_ITEM_RE);
    if (m2) {
      if (!inUl) {
        if (inOl) out.push("</ol>");
        out.push("<ul>");
        inUl = true;
        inOl = false;
      }
      out.push(`<li>${renderInline(m2[1])}</li>`);
      continue;
    }
    closeLists();
    out.push(`<p>${renderInline(s)}</p>`);
  }
  closeLists();
  return out.join("\n");
}

function page(body: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>:root{--bg:#f7f8fb;--card:#fff;--text:#1f2937;--muted:#6b7280;--line:#e5e7eb;--accent:#2563eb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}.wrap{max-width:980px;margin:32px auto 56px;padding:0 20px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px 28px 30px;box-shadow:0 8px 20px rgba(31,41,55,.05)}h1,h2,h3{margin:0;line-height:1.35}h1{font-size:30px;margin-bottom:18px}h2{margin-top:28px;margin-bottom:12px;padding-left:10px;border-left:4px solid var(--accent);font-size:24px}h3{margin-top:18px;margin-bottom:8px;font-size:20px;color:#111827}p{margin:10px 0;color:#111827}ul,ol{margin:8px 0 12px 1.5em;padding:0}li{margin:6px 0}code{background:#eef2ff;color:#3730a3;border-radius:6px;padding:1px 6px;font-size:.92em}a{color:var(--accent);text-decoration:none;border-bottom:1px dashed rgba(37,99,235,.45)}a:hover{border-bottom-style:solid}.footer{margin-top:20px;color:var(--muted);font-size:13px}</style>
</head><body><main class="wrap"><article class="card">${body}<div class="footer">由 ai-daily/scripts/render_report_html.ts 生成</div></article></main></body></html>`;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (!argv[0]) throw new Error("用法: bun scripts/render_report_html.ts <input.md> [-o output.html]");
  const input = resolve(argv[0]);
  if (!existsSync(input)) throw new Error(`输入文件不存在: ${input}`);
  let output = "";
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "-o" || argv[i] === "--output") output = resolve(argv[++i]);
  }
  if (!output) output = input.replace(/\.[^.]+$/, ".html");
  mkdirSync(resolve(output, ".."), { recursive: true });
  const md = readFileSync(input, "utf-8");
  writeFileSync(output, page(markdownToHtml(md), input.split("/").pop() ?? "report"), "utf-8");
  console.log(`[ok] HTML 已生成: ${output}`);
}

try {
  main();
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
}

