#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { Command } from "commander";
import { execaSync } from "execa";
import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CliOptionsSchema = z.object({
  runId: z.string().min(1).optional(),
  date: DateSchema.optional(),
  topic: z.string().min(1).default("daily"),
  props: z.string().min(1).optional(),
  out: z.string().min(1).optional(),
  composition: z.string().min(1).default("DailyVideo"),
  entry: z.string().min(1).default("src/index.tsx"),
  dryRun: z.boolean().default(false),
});
const PropsSchema = z.object({
  date: DateSchema,
  title: z.string().min(1),
  subtitle: z.string().min(1),
  news: z.array(z.any()).min(1),
});

function deriveRunIdFromProps(propsPath: string): string {
  const name = propsPath.split("/").pop() ?? "";
  if (name === "daily.json") return propsPath.split("/").slice(-2, -1)[0] ?? "daily";
  const m = name.match(/^(.*)-(\d{4}-\d{2}-\d{2})\.json$/);
  if (m) return `${m[1]}-${m[2]}`;
  return `daily-${name.replace(/\.json$/, "")}`;
}

function requireProject(remotionDir: string): void {
  const required = [
    remotionDir,
    `${remotionDir}/package.json`,
    `${remotionDir}/src/index.tsx`,
  ];
  const missing = required.filter((p) => !existsSync(p));
  if (missing.length) {
    console.error("错误: 未找到可用的视频工程，请先确认 ai-daily/remotion-daily 完整存在。");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }
}

function resolveProps(root: string, args: z.infer<typeof CliOptionsSchema>): { props: string; runId: string } {
  if (args.props) {
    const p = resolve(args.props);
    if (!existsSync(p)) {
      throw new Error(`错误: --props 指定文件不存在: ${p}`);
    }
    return { props: p, runId: deriveRunIdFromProps(p) };
  }

  if (args.runId) {
    const base = `${root}/runs/${args.runId}`;
    for (const c of [`${base}/daily.json`, `${base}/props.json`]) {
      if (existsSync(c)) return { props: c, runId: args.runId };
    }
    throw new Error(`错误: 未在 run 目录找到 props 文件: ${base}`);
  }

  if (args.date) {
    const runId = `${args.topic}-${args.date}`;
    const candidates = [
      `${root}/runs/${runId}/daily.json`,
      `${root}/runs/${runId}/props.json`,
      `${root}/remotion-daily/data/${args.topic}-${args.date}.json`,
    ];
    for (const c of candidates) {
      if (existsSync(c)) return { props: c, runId };
    }
    throw new Error(`错误: 无法按 --topic/--date 定位 props。run_id=${runId}`);
  }

  throw new Error("错误: 请提供 --props 或 --run-id 或 (--date [--topic])");
}

function main(): void {
  const program = new Command();
  program
    .option("--run-id <id>")
    .option("--date <date>")
    .option("--topic <topic>", "topic name", "daily")
    .option("--props <path>")
    .option("--out <path>")
    .option("--composition <name>", "composition name", "DailyVideo")
    .option("--entry <path>", "entry path", "src/index.tsx")
    .option("--dry-run");
  program.parse(process.argv);
  const args = CliOptionsSchema.parse(program.opts());

  const root = resolve(import.meta.dir, "..");
  const remotionDir = `${root}/remotion-daily`;
  requireProject(remotionDir);

  const { props, runId } = resolveProps(root, args);
  PropsSchema.parse(JSON.parse(readFileSync(props, "utf-8")));
  const out = args.out ? resolve(args.out) : `${root}/runs/${runId}/final.mp4`;
  mkdirSync(dirname(out), { recursive: true });

  const cmd = [
    "bunx",
    "remotion",
    "render",
    String(args.entry),
    String(args.composition),
    out,
    "--props",
    props,
    "--overwrite",
  ];

  console.log("视频生成参数：");
  console.log(`  remotion_dir: ${remotionDir}`);
  console.log(`  props:        ${props}`);
  console.log(`  output:       ${out}`);
  if (args.dryRun) {
    console.log("\n[dry-run] 将执行命令:");
    console.log(cmd.join(" "));
    return;
  }

  execaSync(cmd[0], cmd.slice(1), { cwd: remotionDir, stdio: "inherit" });
}

main();

