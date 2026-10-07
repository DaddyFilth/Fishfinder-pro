#!/usr/bin/env node
// Pulls environment variables from Vercel (which includes values synced by the
// Vercel <-> Supabase integration) into the git-ignored .env.local, then fills
// in Supabase aliases the app expects. Values are never printed.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";

const target = ".env.local";
const environment = process.argv[2] ?? "development";

const pull = spawnSync(
  "npx",
  ["--yes", "vercel", "env", "pull", target, "--yes", `--environment=${environment}`],
  { stdio: ["inherit", "ignore", "inherit"] },
);
if (pull.status !== 0) {
  console.error("vercel env pull failed. Run `npx vercel login` and `npx vercel link` first.");
  process.exit(pull.status ?? 1);
}

const parse = (text) => {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out.set(m[1], m[2].trim().replace(/^(["'])(.*)\1$/, "$2"));
  }
  return out;
};

const text = existsSync(target) ? readFileSync(target, "utf8") : "";
const vars = parse(text);
const added = [];
// Only public values may be mirrored into NEXT_PUBLIC_*; never secret keys.
const aliases = [
  ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
  ["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY"],
  ["SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
];
let extra = "";
// Non-secret defaults so every environment ends up with the same dependencies.
const defaults = {
  GROQ_MODEL: "llama-3.3-70b-versatile",
  GROQ_VISION_MODEL: "llama-4-scout-17b-16e-instruct",
  OPENAI_MODEL: "gpt-4o-mini",
};
for (const [name, value] of Object.entries(defaults)) {
  if (!vars.get(name)) {
    vars.set(name, value);
    extra += `${name}=${value}\n`;
    added.push(name);
  }
}
for (const [name, from] of aliases) {
  if (!vars.get(name) && vars.get(from)) {
    vars.set(name, vars.get(from));
    extra += `${name}=${vars.get(from)}\n`;
    added.push(name);
  }
}
if (extra) writeFileSync(target, text.replace(/\n?$/, "\n") + extra);
try { chmodSync(target, 0o600); } catch {}

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const anyKey = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
// Optional: `node scripts/sync-env.mjs <env> --push` uploads the aliases/defaults
// added above to Vercel so Vercel, Supabase and local stay aligned.
if (process.argv.includes("--push")) {
  for (const name of added) {
    const r = spawnSync("npx", ["--yes", "vercel", "env", "add", name, environment, "--force"], {
      input: vars.get(name), stdio: ["pipe", "ignore", "inherit"],
    });
    if (r.status !== 0) console.warn(`Could not push ${name} to Vercel.`);
  }
}

const missing = required.filter((k) => !vars.get(k));
if (!anyKey.some((k) => vars.get(k))) missing.push(anyKey.join(" or "));
console.log(`Wrote ${vars.size} variables to ${target} (names only: aliases added: ${added.join(", ") || "none"}).`);
if (missing.length) {
  console.warn(`Missing: ${missing.join(", ")}. Enable the Supabase integration in Vercel (Project > Integrations) or add them in Vercel.`);
}
