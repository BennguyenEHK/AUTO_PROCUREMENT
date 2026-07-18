import fs from "node:fs";
import path from "node:path";
import { one, pingDatabase, query, quoteIdent, tableColumns, type Row as QueryRow } from "./client.js";
import { resolveIdentity } from "./identity.js";

type CliOptions = Record<string, string | boolean | undefined>;

const SYSTEM_COLUMNS = new Set(["id", "created_at", "updated_at"]);
const ALLOWED_SUPPLIER_COLUMNS = [
  "rfq_id",
  "item_id",
  "company_id",
  "user_id",
  "supplier_name",
  "source_url",
  "manufacturer",
  "bidder_description",
  "contact_email",
  "contact_phone",
  "social_contact",
  "status",
  "notes",
  "compliance_deviation",
  "match_reasoning",
  "requires_quote",
  "page_type",
  "extraction_confidence",
  "item_origin",
  "evidence",
  "bidder_unit_price",
  "currency_code",
  "delivery_time",
  "available_qty",
  "selling_unit",
  "pack_size"
];

const ALLOWED_PRICING_COLUMNS = [
  "rfq_id",
  "quotation_id",
  "item_id",
  "company_id",
  "user_id",
  "supplier_name",
  "supplier_unit_price",
  "bidder_unit_price",
  "qty",
  "uom",
  "shipping_cost",
  "tax_rate",
  "exchange_rate",
  "profit_rate",
  "discount_rate",
  "exchange_currency",
  "sales_unit_price",
  "ext_price",
  "total_amount",
  "potential_profit",
  "total_profit",
  "currency_code",
  "pricing_payload",
  "notes"
];

const ALLOWED_QUOTATION_COLUMNS = [
  "rfq_id",
  "company_id",
  "user_id",
  "quotation_ref",
  "quotation_number",
  "status",
  "currency_code",
  "total_amount",
  "notes"
];

function parseArgs(argv: string[]): { command: string; options: CliOptions } {
  const [command = "help", ...rest] = argv;
  const options: CliOptions = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return { command, options };
}

function requireString(options: CliOptions, key: string): string {
  const value = options[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function optionalNumber(options: CliOptions, key: string): number | undefined {
  const value = options[key];
  if (value === undefined || value === true) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be numeric`);
  return parsed;
}

function requireNumber(options: CliOptions, key: string): number {
  const parsed = optionalNumber(options, key);
  if (parsed === undefined) throw new Error(`Missing required numeric option --${key}`);
  return parsed;
}

function currentIdentity(options: CliOptions) {
  return resolveIdentity({
    company_id: optionalNumber(options, "company-id"),
    user_id: optionalNumber(options, "user-id")
  });
}

function applyIdentityFilters(filters: QueryRow, liveColumns: Set<string>, options: CliOptions): QueryRow {
  const identity = currentIdentity(options);
  if (liveColumns.has("company_id")) filters.company_id = identity.company_id;
  if (liveColumns.has("user_id")) filters.user_id = identity.user_id;
  return filters;
}

function applyIdentityValues(row: QueryRow, liveColumns: Set<string>, options: CliOptions): QueryRow {
  const identity = currentIdentity(options);
  if (liveColumns.has("company_id") && row.company_id == null) row.company_id = identity.company_id;
  if (liveColumns.has("user_id") && row.user_id == null) row.user_id = identity.user_id;
  return row;
}

function readJsonFile(filePath: string): unknown {
  const resolved = path.resolve(filePath);
  const text = fs.readFileSync(resolved, "utf8");
  return JSON.parse(text);
}

function asRows(input: unknown): QueryRow[] {
  if (Array.isArray(input)) return input as QueryRow[];
  if (input && typeof input === "object" && Array.isArray((input as any).items)) {
    return (input as any).items as QueryRow[];
  }
  if (input && typeof input === "object" && Array.isArray((input as any).rows)) {
    return (input as any).rows as QueryRow[];
  }
  throw new Error("Input JSON must be an array, or an object with an items/rows array.");
}

async function getColumns(table: string): Promise<Set<string>> {
  const columns = await tableColumns(table);
  if (columns.size === 0) throw new Error(`Table not found or has no visible columns: ${table}`);
  return columns;
}

function pickColumns(row: QueryRow, liveColumns: Set<string>, allowedColumns: string[]): QueryRow {
  const out: QueryRow = {};
  for (const key of allowedColumns) {
    if (liveColumns.has(key) && Object.prototype.hasOwnProperty.call(row, key)) {
      out[key] = row[key];
    }
  }
  return out;
}

function buildWhere(parts: QueryRow, startIndex = 1): { clause: string; values: unknown[] } {
  const entries = Object.entries(parts).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) throw new Error("Refusing to build an empty WHERE clause.");
  const clause = entries.map(([key], index) => `${quoteIdent(key)} = $${startIndex + index}`).join(" and ");
  return { clause, values: entries.map(([, value]) => value) };
}

async function insertRow(table: string, row: QueryRow): Promise<QueryRow[]> {
  const entries = Object.entries(row).filter(([key, value]) => !SYSTEM_COLUMNS.has(key) && value !== undefined);
  if (entries.length === 0) throw new Error(`No insertable values for ${table}`);
  const columns = entries.map(([key]) => quoteIdent(key)).join(", ");
  const placeholders = entries.map(([, _value], index) => `$${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);
  return query(`insert into ${quoteIdent(table)} (${columns}) values (${placeholders}) returning *`, values);
}

async function updateRows(table: string, values: QueryRow, where: QueryRow): Promise<QueryRow[]> {
  const setEntries = Object.entries(values).filter(([key, value]) => !SYSTEM_COLUMNS.has(key) && value !== undefined);
  if (setEntries.length === 0) return [];
  const setSql = setEntries.map(([key], index) => `${quoteIdent(key)} = $${index + 1}`).join(", ");
  const setValues = setEntries.map(([, value]) => value);
  const { clause, values: whereValues } = buildWhere(where, setValues.length + 1);
  return query(`update ${quoteIdent(table)} set ${setSql} where ${clause} returning *`, [...setValues, ...whereValues]);
}

async function fetchRfq(options: CliOptions): Promise<unknown> {
  const rfqId = optionalNumber(options, "rfq-id");
  const rfqReference = options["rfq-reference"];
  const liveColumns = await getColumns("rfq_analysis");
  const filters: QueryRow = {};
  if (rfqId !== undefined) filters.rfq_id = rfqId;
  if (typeof rfqReference === "string") filters.rfq_reference = rfqReference;
  applyIdentityFilters(filters, liveColumns, options);
  const { clause, values } = buildWhere(filters);
  return query(`select * from rfq_analysis where ${clause} order by rfq_id desc limit 20`, values);
}

async function fetchItems(options: CliOptions): Promise<unknown> {
  const rfqId = requireNumber(options, "rfq-id");
  const liveColumns = await getColumns("rfq_items");
  const filters = applyIdentityFilters({ rfq_id: rfqId }, liveColumns, options);
  const { clause, values } = buildWhere(filters);
  return query(`select * from rfq_items where ${clause} order by item_id`, values);
}

async function updateStage(options: CliOptions): Promise<unknown> {
  const rfqId = requireNumber(options, "rfq-id");
  const liveColumns = await getColumns("rfq_analysis");
  const values: QueryRow = {};
  for (const [optionKey, column] of [
    ["current-stage", "current_stage"],
    ["stage-status", "stage_status"],
    ["next-required-action", "next_required_action"],
    ["stage-blockers", "stage_blockers"]
  ]) {
    const value = options[optionKey];
    if (typeof value === "string" && liveColumns.has(column)) values[column] = value;
  }
  if (typeof options["completed-stages-json"] === "string" && liveColumns.has("completed_stages")) {
    values.completed_stages = JSON.parse(options["completed-stages-json"]);
  }
  if (liveColumns.has("updated_at")) values.updated_at = new Date().toISOString();
  const where = applyIdentityFilters({ rfq_id: rfqId }, liveColumns, options);
  if (options["dry-run"]) return { dryRun: true, table: "rfq_analysis", where, values, identitySource: currentIdentity(options).source };
  return updateRows("rfq_analysis", values, where);
}

async function upsertSupplierItems(options: CliOptions): Promise<unknown> {
  const rows = asRows(readJsonFile(requireString(options, "input")));
  const liveColumns = await getColumns("supplier_item_status");
  const results: QueryRow[] = [];
  for (const inputRow of rows) {
    const row = pickColumns(inputRow, liveColumns, ALLOWED_SUPPLIER_COLUMNS);
    applyIdentityValues(row, liveColumns, options);
    if (!row.rfq_id || !row.item_id || !row.supplier_name || !row.source_url) {
      results.push({ action: "skipped", reason: "rfq_id, item_id, supplier_name, and source_url are required", inputRow });
      continue;
    }
    const where = applyIdentityFilters({
      rfq_id: row.rfq_id,
      item_id: row.item_id,
      supplier_name: row.supplier_name,
      source_url: row.source_url
    }, liveColumns, options);
    if (options["dry-run"]) {
      results.push({ action: "dry_run_upsert", table: "supplier_item_status", where, row });
      continue;
    }
    const existingWhere = buildWhere(where);
    const existing = await one(
      `select * from supplier_item_status where ${existingWhere.clause} limit 1`,
      existingWhere.values
    );
    const persisted = existing
      ? await updateRows("supplier_item_status", row, { id: existing.id })
      : await insertRow("supplier_item_status", row);
    results.push({ action: existing ? "updated" : "inserted", row: persisted[0] ?? null });
  }
  return results;
}

async function upsertPricing(options: CliOptions): Promise<unknown> {
  const input = readJsonFile(requireString(options, "input")) as QueryRow;
  const rows = asRows(input);
  const pricingColumns = await getColumns("quotation_pricing");
  const results: QueryRow[] = [];
  for (const inputRow of rows) {
    const row = pickColumns(inputRow, pricingColumns, ALLOWED_PRICING_COLUMNS);
    applyIdentityValues(row, pricingColumns, options);
    if (!row.quotation_id && input.quotation_id) row.quotation_id = input.quotation_id;
    if (!row.quotation_id || !row.item_id) {
      results.push({ action: "skipped", reason: "quotation_id and item_id are required for quotation_pricing", inputRow });
      continue;
    }
    const where = applyIdentityFilters(
      { quotation_id: row.quotation_id, item_id: row.item_id },
      pricingColumns,
      options
    );
    if (options["dry-run"]) {
      results.push({ action: "dry_run_upsert", table: "quotation_pricing", where, row, identitySource: currentIdentity(options).source });
      continue;
    }
    const existingWhere = buildWhere(where);
    const existing = await one(
      `select * from quotation_pricing where ${existingWhere.clause} limit 1`,
      existingWhere.values
    );
    const persisted = existing
      ? await updateRows("quotation_pricing", row, where)
      : await insertRow("quotation_pricing", row);
    results.push({ action: existing ? "updated" : "inserted", table: "quotation_pricing", row: persisted[0] ?? null });
  }
  if (input.quotation && typeof input.quotation === "object") {
    const quotationColumns = await getColumns("quotations");
    const quotation = pickColumns(input.quotation as QueryRow, quotationColumns, ALLOWED_QUOTATION_COLUMNS);
    applyIdentityValues(quotation, quotationColumns, options);
    if (!options["dry-run"] && Object.keys(quotation).length > 0) {
      const persisted = await insertRow("quotations", quotation);
      results.push({ action: "inserted", table: "quotations", row: persisted[0] ?? null });
    } else {
      results.push({ action: "dry_run_insert", table: "quotations", row: quotation });
    }
  }
  return results;
}

async function cleanupWatch(options: CliOptions): Promise<unknown> {
  const rfqId = optionalNumber(options, "rfq-id");
  const rfqReference = options["rfq-reference"];
  if (rfqId === undefined && typeof rfqReference !== "string") {
    throw new Error("cleanup-watch requires --rfq-id or --rfq-reference");
  }
  const apply = Boolean(options.apply);
  const tables = ["rfq_watch_targets", "scheduled_tasks"];
  const result: QueryRow[] = [];
  for (const table of tables) {
    const columns = await getColumns(table);
    const filters: QueryRow = {};
    if (rfqId !== undefined && columns.has("rfq_id")) filters.rfq_id = rfqId;
    if (typeof rfqReference === "string" && columns.has("rfq_reference")) filters.rfq_reference = rfqReference;
    if (typeof rfqReference === "string" && columns.has("subject")) filters.subject = rfqReference;
    applyIdentityFilters(filters, columns, options);
    if (Object.keys(filters).length === 0) {
      result.push({ table, action: "skipped", reason: "No safe RFQ filter column found" });
      continue;
    }
    const { clause, values } = buildWhere(filters);
    const candidates = await query(`select * from ${quoteIdent(table)} where ${clause}`, values);
    if (!apply) {
      result.push({
        table,
        action: "dry_run",
        filters,
        count: candidates.length,
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          rfq_id: candidate.rfq_id,
          rfq_reference: candidate.rfq_reference,
          subject: candidate.subject,
          task_type: candidate.task_type,
          watch_type: candidate.watch_type
        }))
      });
      continue;
    }
    const deleted = await query(`delete from ${quoteIdent(table)} where ${clause} returning *`, values);
    result.push({ table, action: "deleted", filters, count: deleted.length, deleted });
  }
  return result;
}

async function describeTable(options: CliOptions): Promise<unknown> {
  const table = requireString(options, "table");
  return query(
    "select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
    [table]
  );
}

async function identity(options: CliOptions): Promise<unknown> {
  const resolved = currentIdentity(options);
  return {
    company_id: resolved.company_id,
    user_id: resolved.user_id,
    source: resolved.source,
    warnings: resolved.warnings
  };
}

const commands: Record<string, (options: CliOptions) => Promise<unknown>> = {
  ping: async () => pingDatabase(),
  identity,
  "describe-table": describeTable,
  "fetch-rfq": fetchRfq,
  "fetch-items": fetchItems,
  "update-stage": updateStage,
  "upsert-supplier-items": upsertSupplierItems,
  "upsert-pricing": upsertPricing,
  "cleanup-watch": cleanupWatch
};

export async function runDatabaseCommand(argv: string[]): Promise<unknown> {
  const { command, options } = parseArgs(argv);
  if (command === "help") {
    return {
      commands: Object.keys(commands),
      examples: [
        "npm.cmd run db -- ping",
        "npm.cmd run db -- identity",
        "npm.cmd run db -- describe-table --table rfq_analysis",
        "npm.cmd run db -- fetch-rfq --rfq-id 123",
        "npm.cmd run db -- fetch-items --rfq-id 123",
        "npm.cmd run db -- update-stage --rfq-id 123 --current-stage supplier_search --stage-status in_progress --dry-run",
        "npm.cmd run db -- upsert-supplier-items --input supplier-items.json --dry-run",
        "npm.cmd run db -- upsert-pricing --input pricing-output-approved.json --dry-run",
        "npm.cmd run db -- cleanup-watch --rfq-id 123 --dry-run",
        "npm.cmd run db -- cleanup-watch --rfq-id 123 --apply"
      ]
    };
  }
  const handler = commands[command];
  if (!handler) throw new Error(`Unknown database command: ${command}`);
  return handler(options);
}
