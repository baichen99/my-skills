#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execaSync } from "execa";
import { Command } from "commander";
import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须是 YYYY-MM-DD");
const CliOptionsSchema = z.object({
  newsJson: z.string().min(1),
  audioDir: z.string().min(1),
  outJson: z.string().min(1),
  date: DateSchema.optional(),
});
const AgentNewsItemSchema = z.object({
  idx: z.number().int().positive(),
  category: z.string().min(1),
  summary: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  publishTime: z.string().optional(),
});
const AgentNewsSchema = z.object({
  date: DateSchema,
  title: z.string().min(1).default("AI 日报"),
  subtitle: z.string().min(1).default("聚焦AI领域最新动态"),
  news: z.array(AgentNewsItemSchema).min(1),
});
const NewsOutputItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.string().min(1),
  source: z.string().min(1),
  publishTime: z.string(),
  audio: z.string().startsWith("data:audio/mpeg;base64,"),
  duration: z.number().int().min(2),
});
const PayloadSchema = z.object({
  date: DateSchema,
  title: z.string().min(1),
  subtitle: z.string().min(1),
  news: z.array(NewsOutputItemSchema).min(1),
  backgroundAudio: z.string().startsWith("data:audio/mpeg;base64,"),
  openingDuration: z.number().int().min(2),
  endingAudio: z.string().startsWith("data:audio/mpeg;base64,"),
  endingDuration: z.number().int().min(2),
});

function ffprobeDuration(mp3Path: string): number {
  const r = execaSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nk=1:nw=1",
    mp3Path,
  ]);
  const dur = Number(String(r.stdout).trim());
  if (!Number.isFinite(dur) || dur <= 0) throw new Error(`invalid duration for ${mp3Path}: ${String(r.stdout).trim()}`);
  return dur;
}

function audioDataUri(mp3Path: string): string {
  const b = readFileSync(mp3Path);
  return `data:audio/mpeg;base64,${b.toString("base64")}`;
}

function safeFilename(s: string): string {
  const v = s.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return v || "item";
}

function titleFromDescription(desc: string): string {
  const first = desc.split(/[。！？!?；;]/, 1)[0].trim() || desc.trim();
  return first.length > 42 ? first.slice(0, 42).trim() : first || "新闻要点";
}

function main(): void {
  const program = new Command();
  program
    .requiredOption("--news-json <path>")
    .requiredOption("--audio-dir <path>")
    .requiredOption("--out-json <path>")
    .option("--date <date>");
  program.parse(process.argv);
  const options = CliOptionsSchema.parse(program.opts());
  const newsJsonPath = options.newsJson;
  const audioDir = options.audioDir;
  const outJson = options.outJson;
  const dateArg = options.date;

  const newsJson = resolve(newsJsonPath);
  const audio = resolve(audioDir);
  const out = resolve(outJson);
  if (!existsSync(newsJson)) throw new Error(`news json not found: ${newsJson}`);
  if (!existsSync(audio)) throw new Error(`audio dir not found: ${audio}`);

  const agentNews = AgentNewsSchema.parse(JSON.parse(readFileSync(newsJson, "utf-8")));
  const date = DateSchema.parse(dateArg || agentNews.date);

  const openingMp3 = resolve(audio, "opening.mp3");
  const endingMp3 = resolve(audio, "ending.mp3");
  if (!existsSync(openingMp3)) throw new Error(`missing opening mp3: ${openingMp3}`);
  if (!existsSync(endingMp3)) throw new Error(`missing ending mp3: ${endingMp3}`);

  const todayNews = [...agentNews.news].sort((a, b) => a.idx - b.idx);

  const newsOut = todayNews.map((item, i) => {
    const newsMp3 = resolve(audio, `news-${i + 1}.mp3`);
    if (!existsSync(newsMp3)) throw new Error(`missing news audio: ${newsMp3}`);
    const dur = ffprobeDuration(newsMp3);
    const host = (() => {
      try {
        return new URL(item.url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    const title = item.title?.trim() ? item.title.trim() : titleFromDescription(item.summary);
    return NewsOutputItemSchema.parse({
      id: `${i + 1}-${safeFilename(title).slice(0, 40)}`,
      title,
      summary: item.summary,
      category: item.category,
      source: item.source?.trim() || host || item.category,
      publishTime: item.publishTime ?? "",
      audio: audioDataUri(newsMp3),
      duration: Math.max(2, Math.ceil(dur)),
    });
  });

  const openingDur = ffprobeDuration(openingMp3);
  const endingDur = ffprobeDuration(endingMp3);
  const payload = PayloadSchema.parse({
    date,
    title: agentNews.title,
    subtitle: agentNews.subtitle,
    news: newsOut,
    backgroundAudio: audioDataUri(openingMp3),
    openingDuration: Math.max(2, Math.ceil(openingDur)),
    endingAudio: audioDataUri(endingMp3),
    endingDuration: Math.max(2, Math.ceil(endingDur)),
  });
  mkdirSync(resolve(out, ".."), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`[BuildProps] wrote: ${out}`);
}

try {
  main();
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
}

