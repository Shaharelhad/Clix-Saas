#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");

function extractExports(src) {
  const names = new Set();
  const declRe = /^export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+(\w+)/gm;
  for (const m of src.matchAll(declRe)) names.add(m[1]);
  const groupRe = /^export\s*\{([^}]+)\}/gm;
  for (const m of src.matchAll(groupRe)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function extractImports(src) {
  const results = [];
  const importRe = /import\s*(?:type\s+)?\{([^}]+)\}\s*from\s*["']([^"']+)["']/gs;
  for (const m of src.matchAll(importRe)) {
    const spec = m[2];
    if (!spec.startsWith("../_shared/")) continue;
    const names = m[1]
      .split(",")
      .map((raw) => raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    results.push({ spec, names });
  }
  return results;
}

function listEdgeFunctionEntries() {
  const entries = [];
  for (const name of readdirSync(FUNCTIONS_DIR)) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const dir = join(FUNCTIONS_DIR, name);
    if (!statSync(dir).isDirectory()) continue;
    const entry = join(dir, "index.ts");
    try { statSync(entry); } catch { continue; }
    entries.push(entry);
  }
  return entries;
}

const sharedExports = new Map();
for (const name of readdirSync(join(FUNCTIONS_DIR, "_shared"))) {
  if (!name.endsWith(".ts")) continue;
  const abs = join(FUNCTIONS_DIR, "_shared", name);
  sharedExports.set(abs, extractExports(readFileSync(abs, "utf8")));
}

const problems = [];
for (const entry of listEdgeFunctionEntries()) {
  const src = readFileSync(entry, "utf8");
  for (const { spec, names } of extractImports(src)) {
    const targetAbs = resolve(dirname(entry), spec);
    const exp = sharedExports.get(targetAbs);
    if (!exp) {
      problems.push(`${relative(ROOT, entry)} imports from missing file ${spec}`);
      continue;
    }
    for (const name of names) {
      if (!exp.has(name)) {
        problems.push(`${relative(ROOT, entry)} imports '${name}' from ${spec}, but ${relative(ROOT, targetAbs)} does not export it`);
      }
    }
  }
}

if (problems.length) {
  console.error(`\u274c ${problems.length} shared-import mismatch(es):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`\nDeploying with these mismatches will crash the function at boot with "does not provide an export named <X>".`);
  process.exit(1);
}

console.log("\u2705 All edge function imports from _shared/ resolve to existing exports.");
