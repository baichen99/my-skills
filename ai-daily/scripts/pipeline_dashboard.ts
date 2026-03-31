#!/usr/bin/env bun
// @ts-nocheck

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";

const STAGES = ["md", "html", "audio", "props", "video"] as const;
type Stage = (typeof STAGES)[number];
type StageStatus = "pending" | "running" | "done" | "failed";

function pageHtml(defaultRunId: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI Daily Pipeline Dashboard</title>
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121a33;
      --line: #2b3558;
      --text: #e7ecff;
      --muted: #9aa8d6;
      --pending: #6b7280;
      --running: #3b82f6;
      --done: #22c55e;
      --failed: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: radial-gradient(1200px 500px at 15% 0%, #1b2850 0, var(--bg) 45%);
      color: var(--text);
      font: 14px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100vh;
    }
    .wrap { max-width: 1080px; margin: 28px auto; padding: 0 18px 36px; }
    .card { background: rgba(18,26,51,.85); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
    .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 12px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    input {
      background: #0f1730;
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      min-width: 220px;
    }
    button {
      background: #1f2f5f;
      color: var(--text);
      border: 1px solid #39508f;
      border-radius: 10px;
      padding: 10px 12px;
      cursor: pointer;
    }
    .meta { color: var(--muted); margin-top: 8px; }
    .graph {
      margin-top: 14px;
      display: grid;
      grid-template-columns: repeat(5, minmax(120px, 1fr));
      gap: 10px;
      align-items: center;
    }
    .node {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      text-align: center;
      background: #101935;
      position: relative;
    }
    .node::after {
      content: "→";
      position: absolute;
      right: -12px;
      top: 50%;
      transform: translateY(-50%);
      color: #7183c7;
    }
    .node:last-child::after { content: ""; }
    .name { font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .status {
      margin-top: 6px;
      display: inline-block;
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 12px;
      border: 1px solid transparent;
    }
    .pending { color: #d1d5db; background: rgba(107,114,128,.15); border-color: rgba(107,114,128,.4); }
    .running { color: #bfdbfe; background: rgba(59,130,246,.2); border-color: rgba(59,130,246,.5); }
    .done { color: #bbf7d0; background: rgba(34,197,94,.2); border-color: rgba(34,197,94,.5); }
    .failed { color: #fecaca; background: rgba(239,68,68,.2); border-color: rgba(239,68,68,.5); }
    pre {
      margin-top: 14px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #0a1228;
      overflow: auto;
      max-height: 260px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1 class="title">AI Daily 执行看板</h1>
      <div class="row">
        <div>
          <div class="label">Run ID</div>
          <input id="runId" value="${defaultRunId}" />
        </div>
        <div>
          <div class="label">刷新</div>
          <button id="refreshBtn">立即刷新</button>
        </div>
      </div>
      <div class="meta" id="meta">等待读取状态...</div>
      <div class="graph" id="graph"></div>
      <pre id="raw"></pre>
    </div>
  </div>
  <script>
    const stages = ["md", "html", "audio", "props", "video"];
    const graphEl = document.getElementById("graph");
    const metaEl = document.getElementById("meta");
    const rawEl = document.getElementById("raw");
    const runInput = document.getElementById("runId");
    const btn = document.getElementById("refreshBtn");

    function renderNodes(stateObj) {
      graphEl.innerHTML = "";
      for (const stage of stages) {
        const status = (stateObj?.stages?.[stage]) || "pending";
        const div = document.createElement("div");
        div.className = "node";
        div.innerHTML = \`<div class="name">\${stage}</div><span class="status \${status}">\${status}</span>\`;
        graphEl.appendChild(div);
      }
    }

    async function loadState() {
      const runId = runInput.value.trim();
      if (!runId) return;
      try {
        const resp = await fetch(\`/api/state?runId=\${encodeURIComponent(runId)}\`);
        const data = await resp.json();
        if (!resp.ok) {
          metaEl.textContent = "读取失败: " + (data.error || resp.statusText);
          renderNodes(null);
          rawEl.textContent = JSON.stringify(data, null, 2);
          return;
        }
        const updatedAt = data.updated_at || "-";
        metaEl.textContent = \`run_id=\${data.run_id} | updated_at=\${updatedAt} | 每2秒自动刷新\`;
        renderNodes(data);
        rawEl.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        metaEl.textContent = "读取失败: " + String(e);
      }
    }

    btn.addEventListener("click", loadState);
    runInput.addEventListener("change", loadState);
    setInterval(loadState, 2000);
    loadState();
  </script>
</body>
</html>`;
}

function defaultState(runId: string) {
  const stages: Record<Stage, StageStatus> = {
    md: "pending",
    html: "pending",
    audio: "pending",
    props: "pending",
    video: "pending",
  };
  return {
    run_id: runId,
    updated_at: new Date().toISOString(),
    stages,
  };
}

function main(): void {
  const program = new Command();
  program
    .option("--run-id <id>", "默认 run_id", "daily")
    .option("--port <port>", "端口", "4789");
  program.parse(process.argv);
  const options = program.opts();
  const runId = String(options.runId);
  const port = Number(options.port);
  const root = resolve(import.meta.dir, "..");

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/") {
        return new Response(pageHtml(runId), { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (url.pathname === "/api/state") {
        const rid = url.searchParams.get("runId") || runId;
        const p = resolve(root, "runs", rid, "pipeline-state.json");
        if (!existsSync(p)) {
          return Response.json(defaultState(rid));
        }
        try {
          const parsed = JSON.parse(readFileSync(p, "utf-8"));
          return Response.json(parsed);
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 500 });
        }
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`[dashboard] http://localhost:${port}  (run_id=${runId})`);
}

main();
