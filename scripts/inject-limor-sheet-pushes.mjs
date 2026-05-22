#!/usr/bin/env node
// Inject api_call nodes after every variable-collecting node in limorbot's flow,
// so that each turn upserts a row in the Google Sheet relay (see plan:
// .claude/plans/lets-focus-on-limorbot-misty-ripple.md).
//
// Usage:
//   node scripts/inject-limor-sheet-pushes.mjs \
//     --workflow-id <uuid> --integration-id <uuid> --apps-script-url <url> [--dry-run]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIMOR_WORKFLOW_ID = "40a4d8f3-4814-461d-b141-ecfbd8b0cb5c";

const BODY_TEMPLATE = JSON.stringify({
  U_TXR_LName: "{{name}}",
  U_TXR_Lcell: "{{phone}}",
  U_TXR_Lmail: "{{email}}",
  U_TXR_Laddress: "{{home}}",
  U_TXR_Id: "{{ID}}",
  U_TXR_Lage: "{{age}}",
  U_TXR_LRD: "{{a3}}",
  U_TXR_LRBLC: "{{b1}}",
  U_TXR_LRMB: "{{c1}}",
  U_TXR_LRBLT: "{{c2}}",
  U_TXR_LERT: "{{q3}}",
  U_TXR_LCBNT: "{{q1}}",
  U_TXR_LCRC: "{{q2}}",
  U_TXR_LRBBI: "{{a1}}",
  U_TXR_LRMBAS: "{{a2}}",
  U_TXR_LNBranch: "{{d1}}",
});

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--workflow-id=")) out.workflowId = a.slice("--workflow-id=".length);
    else if (a === "--workflow-id") out.workflowId = argv[++i];
    else if (a.startsWith("--integration-id=")) out.integrationId = a.slice("--integration-id=".length);
    else if (a === "--integration-id") out.integrationId = argv[++i];
    else if (a.startsWith("--apps-script-url=")) out.appsScriptUrl = a.slice("--apps-script-url=".length);
    else if (a === "--apps-script-url") out.appsScriptUrl = argv[++i];
  }
  return out;
}

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, "Client/.env"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["'](.*)["']$/, "$1");
  }
  return env;
}

async function fetchWorkflow(supabaseUrl, serviceKey, workflowId) {
  const r = await fetch(
    `${supabaseUrl}/rest/v1/workflows?id=eq.${workflowId}&select=id,name,user_id,flow_json`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!r.ok) throw new Error(`fetchWorkflow ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  if (rows.length !== 1) throw new Error(`expected 1 workflow, got ${rows.length}`);
  return rows[0];
}

async function updateFlowJson(supabaseUrl, serviceKey, workflowId, flowJson) {
  const r = await fetch(
    `${supabaseUrl}/rest/v1/workflows?id=eq.${workflowId}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ flow_json: flowJson }),
    },
  );
  if (!r.ok) throw new Error(`updateFlowJson ${r.status}: ${await r.text()}`);
  return r.json();
}

function isDataCollectingNode(n) {
  if (n.type === "collect_input" && n.data?.variableName) return true;
  if (n.type === "buttons" && n.data?.answerVariable) return true;
  return false;
}

function buildPlan(flow, integrationId, appsScriptEndpoint) {
  const nodes = flow.nodes ?? [];
  const edges = flow.edges ?? [];
  const newNodes = [];
  const newEdges = [];
  const removedEdgeIdxs = new Set();
  const skipped = [];

  // Edge-grouped insertion: for each (source, target) pair where source is a
  // data-saving node, insert one api_call between them. This handles button
  // nodes whose branches go to different downstream nodes (e.g. live limorbot:
  // a1's "yes" branch → a2, "no" branch → age) by giving each unique route its
  // own api_call. Branches that converge on a single target share one api_call.
  const groups = new Map(); // key: `${source}__${target}` → { src, target, edgeIdxs }
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const srcNode = nodes.find((n) => n.id === e.source);
    if (!srcNode || !isDataCollectingNode(srcNode)) continue;
    const key = `${e.source}__${e.target}`;
    if (!groups.has(key)) groups.set(key, { src: srcNode, target: e.target, edgeIdxs: [] });
    groups.get(key).edgeIdxs.push(i);
  }

  // Sort group keys for deterministic node IDs across runs.
  const sortedKeys = [...groups.keys()].sort();
  const pushIdSeq = new Map(); // source.id → counter, used to disambiguate when one source feeds multiple targets

  for (const key of sortedKeys) {
    const { src, target, edgeIdxs } = groups.get(key);
    const seq = (pushIdSeq.get(src.id) ?? 0) + 1;
    pushIdSeq.set(src.id, seq);

    // Stable, descriptive id: sheet_push_<source>__to__<target>
    const pushId = `sheet_push_${src.id}__to__${target}`;
    if (nodes.some((n) => n.id === pushId)) {
      skipped.push({ id: pushId, reason: "already-injected" });
      continue;
    }

    newNodes.push({
      id: pushId,
      type: "api_call",
      position: {
        x: (src.position?.x ?? 0) + 320,
        y: (src.position?.y ?? 0) + (seq - 1) * 60,
      },
      data: {
        type: "api_call",
        label: "Push to Sheet",
        integrationId,
        method: "POST",
        endpoint: appsScriptEndpoint,
        bodyTemplate: BODY_TEMPLATE,
        responseMapping: [],
        errorMessage: "",
      },
    });

    // Redirect every grouped edge: src → target  becomes  src → pushId (preserving sourceHandle).
    // Then add a single pushId → target edge.
    for (const idx of edgeIdxs) {
      removedEdgeIdxs.add(idx);
      const e = edges[idx];
      newEdges.push({
        ...e,
        id: `${e.id || `e_${e.source}_${e.target}`}__via_${pushId}`,
        target: pushId,
      });
    }
    newEdges.push({ id: `e_${pushId}_${target}`, source: pushId, target });
  }

  const keptEdges = edges.filter((_, idx) => !removedEdgeIdxs.has(idx));
  const next = {
    ...flow,
    nodes: [...nodes, ...newNodes],
    edges: [...keptEdges, ...newEdges],
  };

  return {
    nextFlow: next,
    summary: {
      added_nodes: newNodes.length,
      removed_edges: removedEdgeIdxs.size,
      added_edges: newEdges.length,
      skipped,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in Client/.env");

  const workflowId = args.workflowId || LIMOR_WORKFLOW_ID;
  if (!args.integrationId) throw new Error("--integration-id is required");
  if (!args.appsScriptUrl) throw new Error("--apps-script-url is required");

  // The script originally targeted Apps Script (script.google.com) but we switched to a
  // Supabase edge function (sheets-relay) for autonomous deploy. URL is now any HTTPS endpoint.
  const url = new URL(args.appsScriptUrl);
  if (url.protocol !== "https:") {
    throw new Error(`relay URL must be https, got ${url.protocol}`);
  }
  // flow-webhook builds the request URL as `${integration.baseUrl}/${node.data.endpoint}`,
  // so the endpoint on the node is just the path portion (e.g. "/functions/v1/sheets-relay").
  const endpoint = url.pathname + url.search;

  console.log(`[inject] workflow_id=${workflowId}`);
  console.log(`[inject] integration_id=${args.integrationId}`);
  console.log(`[inject] endpoint=${endpoint}`);
  console.log(`[inject] dryRun=${args.dryRun}`);

  const wf = await fetchWorkflow(supabaseUrl, serviceKey, workflowId);
  console.log(`[inject] loaded workflow "${wf.name}" (user_id=${wf.user_id})`);

  const flow = wf.flow_json;
  const beforeNodes = flow.nodes?.length ?? 0;
  const beforeEdges = flow.edges?.length ?? 0;
  console.log(`[inject] before: ${beforeNodes} nodes, ${beforeEdges} edges`);

  // Always back up the pre-change flow_json to a timestamped file
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = resolve(ROOT, "temp-context/backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `flow-${workflowId}-${ts}.json`);
  writeFileSync(backupPath, JSON.stringify(wf, null, 2), "utf8");
  console.log(`[inject] backup saved → ${backupPath}`);

  const { nextFlow, summary } = buildPlan(flow, args.integrationId, endpoint);
  console.log(`[inject] plan: +${summary.added_nodes} nodes, +${summary.added_edges} edges (${summary.removed_edges} edges rewired)`);
  if (summary.skipped.length) {
    console.log(`[inject] skipped (${summary.skipped.length}):`);
    for (const s of summary.skipped) console.log(`         ${s.id} — ${s.reason}`);
  }

  // Show first few new nodes for sanity
  const previewNodes = nextFlow.nodes.filter((n) => n.id.startsWith("sheet_push_")).slice(0, 3);
  for (const n of previewNodes) {
    console.log(`[inject] new node: ${n.id} @ (${n.position.x},${n.position.y}) → integration=${n.data.integrationId}`);
  }

  if (args.dryRun) {
    console.log("[inject] DRY RUN — not writing to Supabase");
    const previewPath = resolve(backupDir, `flow-${workflowId}-${ts}-proposed.json`);
    writeFileSync(previewPath, JSON.stringify(nextFlow, null, 2), "utf8");
    console.log(`[inject] proposed flow_json → ${previewPath}`);
    return;
  }

  await updateFlowJson(supabaseUrl, serviceKey, workflowId, nextFlow);
  console.log(`[inject] DONE — workflow updated. after: ${nextFlow.nodes.length} nodes, ${nextFlow.edges.length} edges`);
}

main().catch((err) => {
  console.error("[inject] FAILED:", err.message);
  process.exit(1);
});
