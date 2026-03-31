#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";

const SITE_RECIPES_DIR = resolve(import.meta.dir, "..", "site-recipes");

function ensureDir(): void {
  mkdirSync(SITE_RECIPES_DIR, { recursive: true });
}

function generateSiteId(url: string, name?: string): string {
  const base0 = (name?.toLowerCase() || new URL(url).host).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let siteId = base0 || "site";
  let n = 1;
  while (existsSync(resolve(SITE_RECIPES_DIR, `${siteId}.yaml`))) {
    siteId = `${base0}-${n++}`;
  }
  return siteId;
}

function detectSiteType(url: string): "rss" | "api" | "html" {
  const u = url.toLowerCase();
  if ([".xml", ".rss", ".atom", "/feed", "/rss"].some((k) => u.includes(k))) return "rss";
  if (u.includes("api.") || u.includes("/api/")) return "api";
  return "html";
}

function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const sp = "  ".repeat(indent);
  return Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        const list = v.map((x) => `${sp}  - ${String(x)}`).join("\n");
        return `${sp}${k}:\n${list}`;
      }
      if (v && typeof v === "object") return `${sp}${k}:\n${toYaml(v as Record<string, unknown>, indent + 1)}`;
      if (typeof v === "string") return `${sp}${k}: ${JSON.stringify(v)}`;
      return `${sp}${k}: ${String(v)}`;
    })
    .join("\n");
}

function generateRecipe(urlInput: string, name?: string): { id: string; yaml: string } {
  const url = urlInput.startsWith("http://") || urlInput.startsWith("https://") ? urlInput : `https://${urlInput}`;
  const u = new URL(url);
  const id = generateSiteId(url, name);
  const siteType = detectSiteType(url);
  const recipe = {
    id,
    name: name || u.host.replace(/^www\./, ""),
    description: `信息源: ${name || url}`,
    access: { url, needsBrowser: true, waitFor: { selector: "body", timeout: 10000 } },
    extraction: {
      listSelector: siteType === "rss" ? "item, entry" : "",
      fallbackSelectors: { listSelector: ["main article", ".news-list > div", ".post-item", ".article-item", "ul li"] },
      fields: {
        title: { selector: "h1, h2, h3, .title", type: "text", fallbackSelectors: [".news-title", ".post-title", ".article-title"] },
        url: {
          selector: "a",
          type: "attribute",
          attribute: "href",
          transform: "resolveUrl",
          baseUrl: `${u.protocol}//${u.host}`,
          fallbackSelectors: ["h1 a", "h2 a", "h3 a", ".title a"],
        },
        publishedAt: { selector: "time, .date, .publish-time", type: "attribute", attribute: "datetime", optional: true },
        description: { selector: ".description, .summary, .excerpt", type: "text", optional: true },
      },
    },
    customHeaders: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: `${u.protocol}//${u.host}/`,
    },
    rateLimit: 1,
    notes: `自动生成的基础模板，需要根据实际页面结构调整选择器配置。\n站点类型: ${siteType}`,
  };
  return { id, yaml: toYaml(recipe as unknown as Record<string, unknown>) + "\n" };
}

function addFeed(url: string, name?: string): void {
  const { id, yaml } = generateRecipe(url, name);
  const file = resolve(SITE_RECIPES_DIR, `${id}.yaml`);
  writeFileSync(file, yaml, "utf-8");
  console.log(`✅ 新信息源已添加: ${id}`);
  console.log(`📝 配置文件: ${file}`);
}

function listFeeds(): void {
  console.log("📋 已配置的信息源:");
  console.log("-".repeat(60));
  const files = readdirSync(SITE_RECIPES_DIR).filter((f) => f.endsWith(".yaml")).sort();
  for (const f of files) {
    const content = readFileSync(resolve(SITE_RECIPES_DIR, f), "utf-8");
    const id = (content.match(/^id:\s*"?([^"\n]+)"?/m)?.[1] || f.replace(/\.yaml$/, "")).trim();
    const name = (content.match(/^name:\s*"?([^"\n]+)"?/m)?.[1] || "").trim();
    const url = (content.match(/^\s*url:\s*"?([^"\n]+)"?/m)?.[1] || "").trim();
    console.log(`${id.padEnd(25)} ${name.padEnd(30)} ✅ 健康`);
    console.log(`  URL: ${url}`);
    console.log("");
  }
}

function verifyFeed(siteId: string): void {
  const file = resolve(SITE_RECIPES_DIR, `${siteId}.yaml`);
  if (!existsSync(file)) throw new Error(`站点 ${siteId} 不存在`);
  const c = readFileSync(file, "utf-8");
  const errors: string[] = [];
  if (!c.match(/^\s*url:\s*.+$/m)) errors.push("缺少access.url配置");
  if (!c.match(/^\s*listSelector:\s*.+$/m)) errors.push("缺少extraction.listSelector配置，请手动设置");
  if (!c.includes("\ntitle:")) errors.push("缺少必填字段: title");
  if (!c.includes("\nurl:")) errors.push("缺少必填字段: url");
  if (errors.length) {
    console.log("❌ 配置存在问题:");
    for (const e of errors) console.log(`  - ${e}`);
    return;
  }
  console.log("✅ 基础配置校验通过");
}

function main(): void {
  ensureDir();
  const program = new Command();
  program.name("feed_submitter").description("管理信息源 recipe");

  program
    .command("add")
    .argument("<url>")
    .option("--name <name>")
    .action((url, options) => {
      addFeed(String(url), options.name ? String(options.name) : undefined);
    });

  program.command("list").action(() => {
    listFeeds();
  });

  program
    .command("verify")
    .argument("<site-id>")
    .action((siteId) => {
      verifyFeed(String(siteId));
    });

  program.parse(process.argv);
}

try {
  main();
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
}

