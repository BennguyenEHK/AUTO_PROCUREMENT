import "server-only";

import { neon } from "@neondatabase/serverless";

export type Row = Record<string, unknown>;

let cachedSql: any;

export function getSql(): any {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to use the QuoteFlow web app.");
  }
  if (!cachedSql) cachedSql = neon(process.env.DATABASE_URL);
  return cachedSql;
}

export async function query<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const sql = getSql();
  if (typeof sql.query === "function") {
    return (await sql.query(text, params)) as T[];
  }
  return (await sql(text, params)) as T[];
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function pingDatabase(): Promise<{ ok: true }> {
  const result = await one<{ ok: number }>("select 1::int as ok");
  if (result?.ok !== 1) {
    throw new Error("QuoteFlow database ping returned an unexpected response.");
  }
  return { ok: true };
}

export async function tableColumns(table: string): Promise<Set<string>> {
  const rows = await query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
    [table]
  );
  return new Set(rows.map((row) => row.column_name));
}

export function quoteIdent(identifier: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

export async function insertReturning(table: string, payload: Row): Promise<Row> {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  if (entries.length === 0) throw new Error(`No insertable values for ${table}`);
  const columns = entries.map(([key]) => quoteIdent(key)).join(", ");
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
  const values = entries.map(([, value]) => value);
  const rows = await query(`insert into ${quoteIdent(table)} (${columns}) values (${placeholders}) returning *`, values);
  return rows[0];
}

export async function updateReturning(table: string, payload: Row, where: Row): Promise<Row | null> {
  const values = Object.entries(payload).filter(([, value]) => value !== undefined);
  const filters = Object.entries(where).filter(([, value]) => value !== undefined && value !== null);
  if (values.length === 0 || filters.length === 0) return null;
  const setSql = values.map(([key], index) => `${quoteIdent(key)} = $${index + 1}`).join(", ");
  const whereSql = filters
    .map(([key], index) => `${quoteIdent(key)} = $${values.length + index + 1}`)
    .join(" and ");
  const rows = await query(
    `update ${quoteIdent(table)} set ${setSql} where ${whereSql} returning *`,
    [...values.map(([, value]) => value), ...filters.map(([, value]) => value)]
  );
  return rows[0] ?? null;
}
