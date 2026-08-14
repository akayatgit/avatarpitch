/**
 * Local SQLite data layer — replaces Supabase Postgres per Ashok's ruling
 * ("No Supabase, anywhere"; AvatarPitch state lives in its own SQLite file
 * on ThinkPad disk, zero coupling to the Watch Tower's Postgres).
 *
 * Design: a document store. Every table is (id, data JSON, created_at,
 * updated_at) and the exported `localDb` object implements the exact subset
 * of the supabase-js query-builder API this codebase uses, so the ~40
 * existing call sites keep working unchanged:
 *
 *   from(t).select(cols).eq()/neq()/in().order().limit().single()/maybeSingle()
 *   from(t).insert(rows).select().single()
 *   from(t).upsert(rows, { ignoreDuplicates })
 *   from(t).update(patch).eq().select().single()
 *   from(t).delete().eq()
 *
 * Also supported because the app relies on them:
 *   - JSON-path filters:  .eq('generated_output->>format', 'jobreel_v1')
 *   - PostgREST relation embeds in select: `content_types:content_type_id (name)`
 */

import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type DatabaseType from 'better-sqlite3';

const KNOWN_TABLES = [
  'agents',
  'content_types',
  'content_creation_requests',
  'generated_images',
  'templates',
] as const;

/** Columns stored natively; everything else lives inside the JSON document. */
const NATIVE_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

function resolveDbPath(): string {
  const configured = process.env.AVATARPITCH_DB_PATH;
  if (configured) return configured;
  return '/srv/avatarpitch/data/avatarpitch.db';
}

let dbInstance: DatabaseType.Database | null = null;

function getDb(): DatabaseType.Database {
  if (dbInstance) return dbInstance;

  // Use require to keep the native module out of client bundles
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3') as typeof DatabaseType;

  let path = resolveDbPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    dbInstance = new Database(path);
  } catch {
    // Dev machines without /srv — fall back to a local data dir
    path = join(process.cwd(), '.data', 'avatarpitch.db');
    mkdirSync(dirname(path), { recursive: true });
    dbInstance = new Database(path);
  }

  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 5000');

  for (const table of KNOWN_TABLES) {
    dbInstance.exec(
      `CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    );
  }

  // Mirrors the Postgres UNIQUE(content_creation_request_id, scene_index, image_index)
  // so upsert({ ignoreDuplicates }) keeps its ON CONFLICT DO NOTHING semantics.
  dbInstance.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_images_unique
     ON generated_images (
       json_extract(data, '$.content_creation_request_id'),
       json_extract(data, '$.scene_index'),
       json_extract(data, '$.image_index')
     )`
  );

  return dbInstance;
}

/* ------------------------------------------------------------------ */
/* Query building                                                      */
/* ------------------------------------------------------------------ */

interface DbError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

interface DbResult<T = any> {
  data: T;
  error: DbError | null;
}

type Filter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'neq'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] };

interface EmbedSpec {
  alias: string;
  foreignKey: string;
}

/** Translate a column reference to a SQL expression over the doc store. */
function columnExpr(column: string): string {
  if (NATIVE_COLUMNS.has(column)) return column;
  // PostgREST JSON-path syntax: parent->>child
  const jsonPath = column.includes('->>')
    ? column.split('->>').map((part) => part.trim())
    : [column];
  const path = jsonPath.map((part) => part.replace(/[^a-zA-Z0-9_]/g, '')).join('.');
  return `json_extract(data, '$.${path}')`;
}

/** Parse relation embeds like `content_types:content_type_id (name)` out of a select string. */
function parseEmbeds(select: string | undefined): EmbedSpec[] {
  if (!select) return [];
  const embeds: EmbedSpec[] = [];
  const re = /(\w+)\s*:\s*(\w+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(select))) {
    embeds.push({ alias: match[1], foreignKey: match[2] });
  }
  return embeds;
}

function materializeRow(row: { id: string; data: string; created_at: string; updated_at: string }) {
  let doc: Record<string, unknown> = {};
  try {
    doc = JSON.parse(row.data) ?? {};
  } catch {
    doc = {};
  }
  return { ...doc, id: row.id, created_at: row.created_at, updated_at: row.updated_at };
}

function splitPayload(payload: Record<string, unknown>) {
  const doc: Record<string, unknown> = {};
  let id: string | null = null;
  let createdAt: string | null = null;
  let updatedAt: string | null = null;
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'id') id = value == null ? null : String(value);
    else if (key === 'created_at') createdAt = value == null ? null : String(value);
    else if (key === 'updated_at') updatedAt = value == null ? null : String(value);
    else doc[key] = value;
  }
  return { doc, id, createdAt, updatedAt };
}

class LocalQuery implements PromiseLike<DbResult> {
  private table: string;
  private mode: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private selectString: string | undefined;
  private wantRows = false;
  private filters: Filter[] = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private payload: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
  private ignoreDuplicates = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns?: string) {
    if (this.mode === 'select') {
      this.selectString = columns;
    }
    this.wantRows = true;
    return this;
  }

  insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }

  upsert(
    payload: Record<string, unknown> | Array<Record<string, unknown>>,
    options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) {
    this.mode = 'upsert';
    this.payload = payload;
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }

  update(patch: Record<string, unknown>) {
    this.mode = 'update';
    this.payload = patch;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ kind: 'neq', column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ kind: 'in', column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  /* -------------------------------------------------------------- */

  private buildWhere(): { sql: string; params: unknown[] } {
    if (this.filters.length === 0) return { sql: '', params: [] };
    const clauses: string[] = [];
    const params: unknown[] = [];
    for (const filter of this.filters) {
      const expr = columnExpr(filter.column);
      if (filter.kind === 'eq') {
        if (filter.value === null) {
          clauses.push(`${expr} IS NULL`);
        } else {
          clauses.push(`${expr} = ?`);
          params.push(normalizeParam(filter.value));
        }
      } else if (filter.kind === 'neq') {
        clauses.push(`${expr} IS NOT ?`);
        params.push(normalizeParam(filter.value));
      } else {
        const placeholders = filter.values.map(() => '?').join(', ');
        clauses.push(`${expr} IN (${placeholders})`);
        params.push(...filter.values.map(normalizeParam));
      }
    }
    return { sql: ` WHERE ${clauses.join(' AND ')}`, params };
  }

  private runSelect(): any[] {
    const db = getDb();
    const where = this.buildWhere();
    let sql = `SELECT id, data, created_at, updated_at FROM ${this.table}${where.sql}`;
    if (this.orderBy.length > 0) {
      sql += ` ORDER BY ${this.orderBy
        .map((o) => `${columnExpr(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`)
        .join(', ')}`;
    }
    if (this.limitCount != null) {
      sql += ` LIMIT ${Math.max(0, Math.floor(this.limitCount))}`;
    }
    const rows = db.prepare(sql).all(...where.params) as Array<{
      id: string;
      data: string;
      created_at: string;
      updated_at: string;
    }>;
    const materialized = rows.map(materializeRow);

    // Relation embeds (e.g. content_types:content_type_id (name))
    for (const embed of parseEmbeds(this.selectString)) {
      const lookup = db.prepare(
        `SELECT id, data, created_at, updated_at FROM ${embed.alias} WHERE id = ?`
      );
      for (const row of materialized as Array<Record<string, any>>) {
        const fk = row[embed.foreignKey];
        row[embed.alias] = fk ? ((lookup.get(String(fk)) as any) ? materializeRow(lookup.get(String(fk)) as any) : null) : null;
      }
    }
    return materialized;
  }

  private execute(): DbResult {
    try {
      const db = getDb();
      const now = new Date().toISOString();

      if (this.mode === 'select') {
        const rows = this.runSelect();
        return this.finalize(rows);
      }

      if (this.mode === 'insert' || this.mode === 'upsert') {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
        const verb = this.mode === 'upsert' && this.ignoreDuplicates ? 'INSERT OR IGNORE' : 'INSERT';
        const stmt = db.prepare(
          `${verb} INTO ${this.table} (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`
        );
        const insertedIds: string[] = [];
        for (const payload of payloads) {
          const { doc, id, createdAt, updatedAt } = splitPayload(payload ?? {});
          const rowId = id ?? randomUUID();
          stmt.run(rowId, JSON.stringify(doc), createdAt ?? now, updatedAt ?? now);
          insertedIds.push(rowId);
        }
        if (!this.wantRows) return { data: null, error: null };
        const rows = insertedIds
          .map((rowId) =>
            db
              .prepare(`SELECT id, data, created_at, updated_at FROM ${this.table} WHERE id = ?`)
              .get(rowId)
          )
          .filter(Boolean)
          .map((row) => materializeRow(row as any));
        return this.finalize(rows);
      }

      if (this.mode === 'update') {
        const patch = (this.payload ?? {}) as Record<string, unknown>;
        const { doc, updatedAt } = splitPayload(patch);
        const where = this.buildWhere();
        const targets = db
          .prepare(`SELECT id, data FROM ${this.table}${where.sql}`)
          .all(...where.params) as Array<{ id: string; data: string }>;
        const updateStmt = db.prepare(
          `UPDATE ${this.table} SET data = ?, updated_at = ? WHERE id = ?`
        );
        const updatedIds: string[] = [];
        for (const target of targets) {
          let existing: Record<string, unknown> = {};
          try {
            existing = JSON.parse(target.data) ?? {};
          } catch {
            existing = {};
          }
          updateStmt.run(JSON.stringify({ ...existing, ...doc }), updatedAt ?? now, target.id);
          updatedIds.push(target.id);
        }
        if (!this.wantRows) return { data: null, error: null };
        const rows = updatedIds
          .map((rowId) =>
            db
              .prepare(`SELECT id, data, created_at, updated_at FROM ${this.table} WHERE id = ?`)
              .get(rowId)
          )
          .filter(Boolean)
          .map((row) => materializeRow(row as any));
        return this.finalize(rows);
      }

      // delete
      const where = this.buildWhere();
      db.prepare(`DELETE FROM ${this.table}${where.sql}`).run(...where.params);
      return { data: null, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          code: 'SQLITE_ERROR',
          message: error instanceof Error ? error.message : 'Local database error',
        },
      };
    }
  }

  private finalize(rows: any[]): DbResult {
    if (this.singleMode === 'single') {
      if (rows.length === 1) return { data: rows[0], error: null };
      return {
        data: null,
        error: { code: 'NO_ROWS', message: `Expected one row, got ${rows.length}` },
      };
    }
    if (this.singleMode === 'maybeSingle') {
      if (rows.length <= 1) return { data: rows[0] ?? null, error: null };
      return {
        data: null,
        error: { code: 'TOO_MANY_ROWS', message: `Expected at most one row, got ${rows.length}` },
      };
    }
    return { data: rows, error: null };
  }

  then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function normalizeParam(value: unknown): unknown {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (value != null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

/**
 * Drop-in replacement for the supabase-js admin client (the query subset
 * this app uses). Storage lives in lib/storage.ts, not here.
 */
export const localDb = {
  from(table: string) {
    return new LocalQuery(table);
  },
};
