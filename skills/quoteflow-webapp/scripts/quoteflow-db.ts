#!/usr/bin/env node

import nextEnv from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runDatabaseCommand } from "../lib/db/commands.js";

const webAppPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(webAppPath);

async function main(): Promise<void> {
  const output = await runDatabaseCommand(process.argv.slice(2));
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
