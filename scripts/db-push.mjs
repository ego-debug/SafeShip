#!/usr/bin/env node
// Runs supabase/schema.sql against the database in SUPABASE_DB_URL.
// Idempotent — every CREATE uses IF NOT EXISTS / OR REPLACE.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

function loadEnvLocal() {
  const text = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvLocal();

if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is not set in .env.local");
  process.exit(1);
}

const schema = readFileSync(resolve(ROOT, "supabase/schema.sql"), "utf8");

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("connected to", new URL(process.env.SUPABASE_DB_URL).hostname);
  await client.query(schema);
  console.log("schema applied ✓");
  const { rows } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name`,
  );
  console.log("tables in public:");
  for (const r of rows) console.log("  " + r.table_name);
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
