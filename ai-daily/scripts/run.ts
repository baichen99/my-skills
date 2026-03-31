#!/usr/bin/env bun
// @ts-nocheck

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { execaSync } from "execa";
import { StateMachine, t } from "typescript-fsm";
import { z } from "zod";

type Stage = "md" | "html" | "audio" | "props" | "video";
type StageStatus = "pending" | "running" | "done" | "failed";
type State = {
  run_id: string;
  updated_at: string;
  stages: Record<Stage, StageStatus>;
};

const STAGES: Stage[] = ["md", "html", "audio", "props", "video"];
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const FullOptionsSchema = z.object({
  voiceMd: z.string().min(1),
  reportMd: z.string().min(1),
  newsJson: z.string().min(1),
  runId: z.string().min(1).optional(),
  audioDir: z.string().min(1).optional(),
  outJson: z.string().min(1).optional(),
  out: z.string().min(1).optional(),
  composition: z.string().min(1).optional(),
  entry: z.string().min(1).optional(),
  date: DateSchema.optional(),
  pauseMs: z.string().min(1).optional(),
  dryRun: z.boolean().default(false),
  restart: z.boolean().default(false),
});

function nowIso(): string {
  return new Date().toISOString();
}

function run(cmd: string[]): void {
  execaSync(cmd[0], cmd.slice(1), { stdio: "inherit" });
}

function needFile(pathValue: string, label: string): string {
  const p = resolve(pathValue);
  if (!existsSync(p)) throw new Error(`${label} not found: ${p}`);
  return p;
}

function deriveRunId(reportMd: string, explicit?: string): string {
  if (explicit) return explicit;
  const parts = resolve(reportMd).split("/");
  return parts[parts.length - 2] || "daily";
}

function extractDate(reportMd: string): string | undefined {
  const m = reportMd.match(/(\d{4}-\d{2}-\d{2})/);
  return m?.[1];
}

function statePath(base: string): string {
  return `${base}/pipeline-state.json`;
}

function initState(runId: string): State {
  return {
    run_id: runId,
    updated_at: nowIso(),
    stages: { md: "pending", html: "pending", audio: "pending", props: "pending", video: "pending" },
  };
}

function saveState(base: string, state: State): void {
  state.updated_at = nowIso();
  mkdirSync(base, { recursive: true });
  writeFileSync(statePath(base), JSON.stringify(state, null, 2), "utf-8");
}

function loadState(base: string, runId: string, restart: boolean): State {
  const sp = statePath(base);
  if (restart || !existsSync(sp)) {
    const s = initState(runId);
    saveState(base, s);
    return s;
  }
  const s = JSON.parse(readFileSync(sp, "utf-8")) as State;
  if (s.run_id !== runId) {
    const n = initState(runId);
    saveState(base, n);
    return n;
  }
  return s;
}

function allDone(state: State): boolean {
  return STAGES.every((s) => state.stages[s] === "done");
}

enum PipelineStateId {
  md = 1,
  html = 2,
  audio = 3,
  props = 4,
  video = 5,
  success = 6,
  failed = 7,
}

enum PipelineEventId {
  next = 1,
  fail = 2,
}

const STAGE_TO_STATE: Record<Stage, PipelineStateId> = {
  md: PipelineStateId.md,
  html: PipelineStateId.html,
  audio: PipelineStateId.audio,
  props: PipelineStateId.props,
  video: PipelineStateId.video,
};

function stateIdToStage(id: PipelineStateId): Stage | null {
  for (const stage of STAGES) {
    if (STAGE_TO_STATE[stage] === id) return stage;
  }
  return null;
}

function createPipelineMachine(): StateMachine<PipelineStateId, PipelineEventId> {
  const noop = async () => {};
  return new StateMachine<PipelineStateId, PipelineEventId>(PipelineStateId.md, [
    t(PipelineStateId.md, PipelineEventId.next, PipelineStateId.html, noop),
    t(PipelineStateId.html, PipelineEventId.next, PipelineStateId.audio, noop),
    t(PipelineStateId.audio, PipelineEventId.next, PipelineStateId.props, noop),
    t(PipelineStateId.props, PipelineEventId.next, PipelineStateId.video, noop),
    t(PipelineStateId.video, PipelineEventId.next, PipelineStateId.success, noop),
    t(PipelineStateId.md, PipelineEventId.fail, PipelineStateId.failed, noop),
    t(PipelineStateId.html, PipelineEventId.fail, PipelineStateId.failed, noop),
    t(PipelineStateId.audio, PipelineEventId.fail, PipelineStateId.failed, noop),
    t(PipelineStateId.props, PipelineEventId.fail, PipelineStateId.failed, noop),
    t(PipelineStateId.video, PipelineEventId.fail, PipelineStateId.failed, noop),
  ]);
}

async function runPipelineWithStateMachine(
  state: State,
  base: string,
  stageCmds: Record<Stage, string[]>
): Promise<{ state: State; ok: boolean }> {
  const machine = createPipelineMachine();
  while (machine.getState() !== PipelineStateId.success && machine.getState() !== PipelineStateId.failed) {
    const stage = stateIdToStage(machine.getState());
    if (!stage) break;

    if (state.stages[stage] === "done") {
      console.log(`[state] skip ${stage}: already done`);
      await machine.dispatch(PipelineEventId.next);
      continue;
    }

    try {
      console.log(`[state] start ${stage}`);
      state.stages[stage] = "running";
      saveState(base, state);
      const command = stageCmds[stage];
      if (command[0] === "__internal_copy_md__") {
        mkdirSync(resolve(command[2], ".."), { recursive: true });
        cpSync(command[1], command[2]);
      } else {
        run(command);
      }
      state.stages[stage] = "done";
      saveState(base, state);
      console.log(`[state] done  ${stage}`);
      await machine.dispatch(PipelineEventId.next);
    } catch (error) {
      state.stages[stage] = "failed";
      saveState(base, state);
      const short = error instanceof Error ? error.message : String(error);
      console.error(`[state] failed ${stage}: ${short}`);
      await machine.dispatch(PipelineEventId.fail);
      return { state, ok: false };
    }
  }

  return { state, ok: machine.getState() === PipelineStateId.success };
}

async function main(): Promise<void> {
  const root = import.meta.dir;
  const program = new Command();
  program.name("run").description("AI Daily pipeline runner");

  program
    .command("audio")
    .argument("<voice_md>")
    .requiredOption("--out-dir <path>")
    .option("--pause-ms <ms>")
    .action((voiceMd, options) => {
      needFile(voiceMd, "voice_md");
      const outDir = String(options.outDir);
      const command = ["bun", `${root}/tts_split_voice_to_audio.ts`, voiceMd, "--out-dir", outDir];
      if (options.pauseMs) command.push("--pause-ms", String(options.pauseMs));
      run(command);
    });

  program
    .command("video")
    .option("--run-id <id>")
    .option("--date <date>")
    .option("--topic <topic>")
    .option("--props <path>")
    .option("--out <path>")
    .option("--composition <name>")
    .option("--entry <path>")
    .option("--dry-run")
    .action(async (options) => {
      const command = ["bun", `${root}/generate_video.ts`];
      const map: Array<[string, string | undefined]> = [
        ["--run-id", options.runId],
        ["--date", options.date],
        ["--topic", options.topic],
        ["--props", options.props],
        ["--out", options.out],
        ["--composition", options.composition],
        ["--entry", options.entry],
      ];
      for (const [k, v] of map) if (v) command.push(k, String(v));
      if (options.dryRun) command.push("--dry-run");
      run(command);
    });

  program
    .command("full")
    .requiredOption("--voice-md <path>")
    .requiredOption("--report-md <path>")
    .requiredOption("--news-json <path>")
    .option("--run-id <id>")
    .option("--audio-dir <path>")
    .option("--out-json <path>")
    .option("--out <path>")
    .option("--composition <name>")
    .option("--entry <path>")
    .option("--date <date>")
    .option("--pause-ms <ms>")
    .option("--dry-run")
    .option("--restart")
    .action(async (rawOptions) => {
      const options = FullOptionsSchema.parse(rawOptions);
      const voiceMd = options.voiceMd;
      const reportMd = options.reportMd;
      const newsJson = options.newsJson;
      needFile(voiceMd, "voice_md");
      needFile(reportMd, "report_md");
      needFile(newsJson, "news_json");

      const runId = deriveRunId(reportMd, options.runId ? String(options.runId) : undefined);
      const base = resolve(root, "..", "runs", runId);
      const mdOut = `${base}/report.md`;
      const htmlOut = `${base}/report.html`;
      const audioDir = options.audioDir ? resolve(String(options.audioDir)) : `${base}/audio`;
      const outJson = options.outJson ? resolve(String(options.outJson)) : `${base}/daily.json`;
      const outMp4 = options.out ? resolve(String(options.out)) : `${base}/final.mp4`;
      const composition = options.composition ? String(options.composition) : "DailyVideo";
      const entry = options.entry ? String(options.entry) : "src/index.tsx";
      const dateVal = options.date ? options.date : extractDate(reportMd);

      const htmlCmd = ["bun", `${root}/render_report_html.ts`, mdOut, "--output", htmlOut];
      const audioCmd = ["bun", `${root}/tts_split_voice_to_audio.ts`, voiceMd, "--out-dir", audioDir];
      if (options.pauseMs) audioCmd.push("--pause-ms", String(options.pauseMs));
      audioCmd.push("--report-md", reportMd);
      const propsCmd = [
        "bun",
        `${root}/build_remotion_daily_props.ts`,
        "--news-json",
        newsJson,
        "--audio-dir",
        audioDir,
        "--out-json",
        outJson,
      ];
      if (dateVal) propsCmd.push("--date", dateVal);
      const videoCmd = [
        "bun",
        `${root}/generate_video.ts`,
        "--props",
        outJson,
        "--out",
        outMp4,
        "--composition",
        composition,
        "--entry",
        entry,
      ];

      if (options.dryRun) {
        console.log("[dry-run] md: copy report to", mdOut);
        console.log("[dry-run] html:", htmlCmd.join(" "));
        console.log("[dry-run] audio:", audioCmd.join(" "));
        console.log("[dry-run] props:", propsCmd.join(" "));
        console.log("[dry-run] video:", videoCmd.join(" "));
        console.log("[dry-run] state file:", statePath(base));
        return;
      }

      const state = loadState(base, runId, Boolean(options.restart));
      if (allDone(state)) {
        console.log(`[state] all stages already done for run_id=${runId}`);
        return;
      }

      const stageCmds: Record<Stage, string[]> = {
        md: ["__internal_copy_md__", reportMd, mdOut],
        html: htmlCmd,
        audio: audioCmd,
        props: propsCmd,
        video: videoCmd,
      };
      const result = await runPipelineWithStateMachine(state, base, stageCmds);
      if (!result.ok) process.exit(1);
      console.log(`[state] pipeline completed: ${runId}`);
    });

  if (process.argv.length <= 2) {
    program.help();
  }
  await program.parseAsync(process.argv);
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});

