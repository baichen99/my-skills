#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";

const TTS_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const DEFAULT_VOICE = "zh_male_M392_conversation_wvae_bigtts";
const DEFAULT_RESOURCE_ID = "seed-tts-2.0";
const CHUNK_CHAR_LIMIT = 480;
const SECTION_TITLES = new Set(["正文", "开场白", "收尾", "元信息"]);

function ttsErrorHint(errBody: string): string {
  try {
    const o = JSON.parse(errBody) as { code?: number; message?: string };
    const msg = String(o.message ?? "");
    if (o.code === 45000000 && msg.includes("access denied")) {
      return "\n---\n【说明】音色或资源未授权，请检查 X-Api-Resource-Id 与 speaker 是否都已开通授权。";
    }
    if (msg.includes("quota exceeded")) {
      return "\n---\n【说明】当前并发或配额不足，请稍后重试，或提升配额。";
    }
    return "";
  } catch {
    return "";
  }
}

function loadSettings(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function blockLinesToPlain(lines: string[]): string {
  const out: string[] = [];
  for (let s of lines.map((x) => x.trim())) {
    if (!s || s === "---" || s.startsWith(">")) continue;
    if (s.startsWith("#")) s = s.replace(/^#+\s*/, "");
    if (SECTION_TITLES.has(s)) continue;
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replaceAll("*", "").replaceAll("`", "");
    if (s) out.push(s);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function xmlEscape(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function packSpeakChunks(speak: string, limit: number): string[] {
  if (speak.length <= limit) return [speak];
  const inner = speak.slice("<speak>".length, -"</speak>".length);
  const parts = inner.split(/(<break time="\d+ms"\/>)/g).filter(Boolean);
  const packed: string[] = [];
  let cur = "<speak>";
  for (const p of parts) {
    if (cur.length + p.length + "</speak>".length > limit && cur !== "<speak>") {
      packed.push(`${cur}</speak>`);
      cur = `<speak>${p}`;
    } else {
      cur += p;
    }
  }
  if (cur !== "<speak>") packed.push(`${cur}</speak>`);
  return packed.length ? packed : [speak];
}

function voiceMdToSsmlChunks(md: string, pauseMs: number, chunkLimit = CHUNK_CHAR_LIMIT): string[] | null {
  const work = md.includes("## 附录") ? md.split("## 附录", 1)[0] : md;
  const afterOpen = work.includes("## 开场白")
    ? work.split("## 开场白", 2)[1]
    : work.replace(/^#\s+.*\n+/, "");
  let opening = "";
  let bodyAndRest = afterOpen;
  if (afterOpen.includes("## 正文")) {
    const arr = afterOpen.split("## 正文", 2);
    opening = arr[0].trim();
    bodyAndRest = arr[1];
  }
  let body = bodyAndRest.trim();
  let closing = "";
  if (bodyAndRest.includes("## 收尾")) {
    const arr = bodyAndRest.split("## 收尾", 2);
    body = arr[0].trim();
    closing = arr[1].trim();
    if (closing.includes("##")) closing = closing.split("##", 1)[0].trim();
  }
  if (!body.includes("###")) return null;

  const subs = body
    .split(/\n(?=###\s)/g)
    .map((raw) => {
      const lines = raw.trim().split("\n");
      if (lines[0]?.match(/^#+\s*/)) lines.shift();
      return blockLinesToPlain(lines);
    })
    .filter(Boolean);

  const segs: string[] = [];
  if (opening) {
    const op = blockLinesToPlain(opening.split("\n"));
    if (op) segs.push(xmlEscape(op));
  }
  for (const s of subs) segs.push(xmlEscape(s));
  if (closing) {
    const cl = blockLinesToPlain(closing.split("\n"));
    if (cl) segs.push(xmlEscape(cl));
  }
  if (segs.length < 2) return null;

  const brk = `<break time="${pauseMs}ms"/>`;
  const speak = `<speak>${segs.join(brk)}</speak>`;
  return packSpeakChunks(speak, chunkLimit);
}

function voiceMdToPlain(md: string): string {
  let block = md;
  if (block.includes("## 附录")) block = block.split("## 附录", 1)[0];
  if (block.includes("## 开场白")) block = block.split("## 开场白", 2)[1];
  else block = block.replace(/^#\s+.*\n+/, "");
  return blockLinesToPlain(block.split("\n"));
}

function splitForTts(text: string, limit = CHUNK_CHAR_LIMIT): string[] {
  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let buf = "";
  for (const seg of text.split(/(?<=[。！？!?；;\n])/g)) {
    if (!seg) continue;
    if (buf.length + seg.length <= limit) buf += seg;
    else {
      if (buf) parts.push(buf.trim());
      buf = seg;
      while (buf.length > limit) {
        parts.push(buf.slice(0, limit));
        buf = buf.slice(limit);
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function readJsonObjects(buffer: string): { objects: Array<Record<string, unknown>>; rest: string } {
  const objects: Array<Record<string, unknown>> = [];
  let inString = false;
  let escaped = false;
  let depth = 0;
  let start = -1;
  let lastEnd = 0;

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        const raw = buffer.slice(start, i + 1);
        try {
          const obj = JSON.parse(raw) as Record<string, unknown>;
          objects.push(obj);
        } catch {
          // ignore broken json piece; keep scanning remaining stream
        }
        lastEnd = i + 1;
        start = -1;
      }
    }
  }

  if (depth > 0 && start >= 0) return { objects, rest: buffer.slice(start) };
  return { objects, rest: buffer.slice(lastEnd) };
}

async function ttsChunk(
  appid: string,
  accessToken: string,
  resourceId: string,
  text: string,
  voiceType: string,
  encoding: string,
  useSsml: boolean,
  model?: string
): Promise<Uint8Array> {
  const reqParams: Record<string, unknown> = {
    speaker: voiceType,
    audio_params: { format: encoding, sample_rate: 24000 },
  };
  if (model) reqParams.model = model;
  if (useSsml) reqParams.ssml = text;
  else reqParams.text = text;
  const body = { user: { uid: "ai-daily" }, req_params: reqParams };

  const requestId = crypto.randomUUID();
  const resp = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "X-Api-App-Id": appid,
      "X-Api-Access-Key": accessToken,
      "X-Api-Resource-Id": resourceId,
      "X-Api-Request-Id": requestId,
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": "ai-daily-voice_to_audio-ts/2.0",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const raw = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${raw}${ttsErrorHint(raw)}`);
  }
  if (!resp.body) throw new Error("响应无 body（流式数据为空）");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const parts: Buffer[] = [];
  let sawFinish = false;
  let errorMessage = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parsed = readJsonObjects(buf);
    buf = parsed.rest;
    for (const obj of parsed.objects) {
      const code = Number(obj.code ?? -1);
      const message = String(obj.message ?? "");
      const data = obj.data;
      if (typeof data === "string" && data) {
        parts.push(Buffer.from(data, "base64"));
      }
      if (code === 20000000) {
        sawFinish = true;
        continue;
      }
      if (code !== 0) {
        errorMessage = `TTS 错误 code=${code}: ${message || JSON.stringify(obj)}`;
      }
    }
  }

  if (errorMessage) throw new Error(`${errorMessage}${ttsErrorHint(JSON.stringify({ message: errorMessage }))}`);
  if (!parts.length) throw new Error("未收到任何音频分片");
  if (!sawFinish) console.error("[Warn] 未检测到 SessionFinish(20000000)，已按收到的音频数据继续。");
  return Uint8Array.from(Buffer.concat(parts));
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .argument("<input-md>")
    .option("-o, --output <path>")
    .option("--voice <voiceType>")
    .option("--encoding <encoding>")
    .option("--plain")
    .option("--pause-ms <ms>");
  program.parse(process.argv);
  const options = program.opts();
  const input = resolve(String(program.args[0]));
  if (!existsSync(input)) throw new Error(`文件不存在: ${input}`);
  const output = options.output ? resolve(String(options.output)) : "";
  const voiceArg = options.voice ? String(options.voice) : "";
  const encodingArg = options.encoding ? String(options.encoding) : "";
  const plain = Boolean(options.plain);
  const pauseMsArg = options.pauseMs ? Number(options.pauseMs) : null;

  const root = resolve(import.meta.dir, "..");
  const settings = loadSettings(`${root}/settings.json`);
  const vt = (settings.volc_tts ?? {}) as Record<string, unknown>;
  const envOrFlat = (name: string): string => {
    const ev = Bun.env[name];
    if (ev?.trim()) return ev.trim();
    const fv = settings[name];
    if (typeof fv === "string" && fv.trim()) return fv.trim();
    return "";
  };
  const nested = (...keys: string[]): string => {
    for (const k of keys) {
      const nv = vt[k];
      if (typeof nv === "string" && nv.trim()) return nv.trim();
    }
    return "";
  };
  const appid = envOrFlat("VOLC_TTS_APPID") || nested("appid");
  const token = envOrFlat("VOLC_TTS_ACCESS_TOKEN") || nested("access_token", "accessToken");
  const voice = voiceArg || envOrFlat("VOLC_TTS_VOICE_TYPE") || nested("voice_type") || DEFAULT_VOICE;
  const encoding = encodingArg || envOrFlat("VOLC_TTS_ENCODING") || nested("encoding") || "mp3";
  const resourceId = envOrFlat("VOLC_TTS_RESOURCE_ID") || nested("resource_id", "resourceId") || DEFAULT_RESOURCE_ID;
  const model = envOrFlat("VOLC_TTS_MODEL") || nested("model");
  const pauseMs = pauseMsArg ?? Number(envOrFlat("VOLC_TTS_PAUSE_MS") || nested("pause_ms") || "900");
  if (!appid || !token) throw new Error("请设置 VOLC_TTS_APPID 与 VOLC_TTS_ACCESS_TOKEN。");

  const md = readFileSync(input, "utf-8");
  const ssmlChunks = !plain ? voiceMdToSsmlChunks(md, pauseMs) : null;
  const chunks = ssmlChunks ?? splitForTts(voiceMdToPlain(md));
  if (!chunks.length) throw new Error("未能从 Markdown 提取可读文本");

  const parts: Uint8Array[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.error(`合成片段 ${i + 1}/${chunks.length}，长度 ${chunks[i].length} …`);
    parts.push(await ttsChunk(appid, token, resourceId, chunks[i], voice, encoding, Boolean(ssmlChunks), model));
  }
  const blob = Buffer.concat(parts.map((p) => Buffer.from(p)));
  const out = output || input.replace(/\.[^.]+$/, "") + "." + encoding.toLowerCase().split("_")[0];
  writeFileSync(out, blob);
  console.log(`已写入: ${out} (${blob.length} bytes)`);
}

main().catch((e) => {
  console.error(String(e instanceof Error ? e.message : e));
  process.exit(1);
});

