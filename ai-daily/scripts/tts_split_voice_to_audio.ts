#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execaSync } from "execa";
import { Command } from "commander";
import { z } from "zod";

const CliOptionsSchema = z.object({
  outDir: z.string().min(1),
  pauseMs: z.string().regex(/^\d+$/).optional(),
  reportMd: z.string().min(1).optional(),
});

function extractSection(md: string, header: string): string | null {
  const m = md.match(new RegExp(`^##\\s+${header}\\s*$`, "m"));
  if (!m || m.index == null) return null;
  const start = m.index + m[0].length;
  const rest = md.slice(start);
  const m2 = rest.match(/^##\s+.+$/m);
  const end = start + (m2?.index ?? rest.length);
  return md.slice(start, end).trim();
}

function extractBodyNews(md: string): string[] {
  const body = extractSection(md, "正文");
  if (!body) return [];
  return body
    .split(/^###\s+.+$/gm)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseTodayNewsCount(reportMd: string): number {
  const h = reportMd.match(/^##\s+今日资讯\s*$/m);
  if (!h || h.index == null) return 0;
  const start = h.index + h[0].length;
  const rest = reportMd.slice(start);
  const next = rest.match(/^##\s+.+$/m);
  const block = reportMd.slice(start, start + (next?.index ?? rest.length)).trim();
  const lines = block
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => /^\d+\.\s/.test(x));
  return lines.length;
}

function runVoiceToAudio(voiceMd: string, outMp3: string, pauseMs?: string): void {
  const script = resolve(import.meta.dir, "voice_to_audio.ts");
  const cmd = ["bun", script, voiceMd, "-o", outMp3, "--plain"];
  if (pauseMs) cmd.push("--pause-ms", pauseMs);
  const r = execaSync(cmd[0], cmd.slice(1), { reject: false });
  if (r.exitCode !== 0) {
    const msg = [String(r.stdout ?? "").trim(), String(r.stderr ?? "").trim()].filter(Boolean).join("\n");
    throw new Error(msg || `voice_to_audio failed: exitCode=${r.exitCode}`);
  }
}

function estimateDurationSec(text: string): number {
  const chars = text.trim().length;
  return Math.max(2, Math.ceil(chars / 14));
}

function makeSilentMp3(pathValue: string, durationSec: number): void {
  execaSync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=24000:cl=mono",
    "-t",
    String(durationSec),
    "-q:a",
    "9",
    "-acodec",
    "libmp3lame",
    pathValue,
  ]);
}

function runWithFallback(voiceMd: string, outMp3: string, sourceText: string, pauseMs?: string): void {
  try {
    runVoiceToAudio(voiceMd, outMp3, pauseMs);
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("quota exceeded")) {
      const sec = estimateDurationSec(sourceText);
      console.error(`[TTS][fallback] 检测到配额不足，改为静音占位音频: ${outMp3} (${sec}s)`);
      makeSilentMp3(outMp3, sec);
      return;
    }
    throw e;
  }
}

function main(): void {
  const program = new Command();
  program
    .argument("<voice-md>")
    .requiredOption("--out-dir <dir>")
    .option("--pause-ms <ms>")
    .option("--report-md <path>");
  program.parse(process.argv);
  const options = CliOptionsSchema.parse(program.opts());
  const voiceArg = z.string().min(1).parse(program.args[0]);
  const voiceMdPath = resolve(String(voiceArg));
  if (!existsSync(voiceMdPath)) throw new Error(`voice md not found: ${voiceMdPath}`);
  const outDir = resolve(String(options.outDir));
  const pauseMs = options.pauseMs ? String(options.pauseMs) : "";
  const reportMdPath = options.reportMd ? resolve(String(options.reportMd)) : "";

  const md = readFileSync(voiceMdPath, "utf-8");
  const opening = extractSection(md, "开场白") ?? "";
  const ending = extractSection(md, "收尾") ?? "";
  const newsSegments = extractBodyNews(md);
  const expectedNewsCount =
    reportMdPath && existsSync(reportMdPath) ? parseTodayNewsCount(readFileSync(reportMdPath, "utf-8")) : 0;

  if (!newsSegments.length) throw new Error("未能从 `## 正文` 解析到任何 `###` 新闻分段。");
  if (!opening.trim()) console.error("[Warn] 开场白段落为空或缺失。");
  if (!ending.trim()) console.error("[Warn] 收尾段落为空或缺失。");

  mkdirSync(outDir, { recursive: true });
  const tempDir = mkdtempSync(resolve(tmpdir(), "ai-daily-tts-"));
  const tmpMd = (title: string, text: string): string => {
    const p = resolve(tempDir, `${title}.md`);
    writeFileSync(p, `# ${title}\n\n${text.trim()}\n`, "utf-8");
    return p;
  };

  try {
    console.log(`[TTS] opening -> ${resolve(outDir, "opening.mp3")}`);
    runWithFallback(tmpMd("opening", opening), resolve(outDir, "opening.mp3"), opening, pauseMs || undefined);
    for (let i = 0; i < newsSegments.length; i++) {
      const out = resolve(outDir, `news-${i + 1}.mp3`);
      console.log(`[TTS] news ${i + 1} -> ${out}`);
      runWithFallback(tmpMd(`news-${i + 1}`, newsSegments[i]), out, newsSegments[i], pauseMs || undefined);
    }
    if (expectedNewsCount > newsSegments.length) {
      for (let i = newsSegments.length; i < expectedNewsCount; i++) {
        const out = resolve(outDir, `news-${i + 1}.mp3`);
        const placeholder = `第${i + 1}条新闻音频占位`;
        console.error(`[TTS][fallback] 语音脚本条数不足，补齐静音: ${out}`);
        makeSilentMp3(out, estimateDurationSec(placeholder));
      }
    }
    console.log(`[TTS] ending -> ${resolve(outDir, "ending.mp3")}`);
    runWithFallback(tmpMd("ending", ending), resolve(outDir, "ending.mp3"), ending, pauseMs || undefined);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
}

