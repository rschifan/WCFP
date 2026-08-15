/**
 * DuckDB singleton — READ_ONLY connection pool.
 *
 * Schema (created by scripts/build-duckdb.js):
 *   species            wcfp_id (PK), taxon_name, authors, family, genus,
 *                      kingdom, phylum, class, order, lifeform, cwr,
 *                      use_* boolean flags, source_link, references_all,
 *                      uses_total
 *   distribution       code + wcfp_id (PK), FK → species, occurrence_status,
 *                      introduced / extinct / location_doubtful flags
 *   regions            code (PK), area, country, iso_alpha2, iso_alpha3,
 *                      unique_count_published, percentage, flora_richness,
 *                      pct_of_flora, geom
 *   region_stats       code (PK), total_species, family_count (pre-aggregated)
 *   region_top_families  code, family, cnt, rank (top 10 per region)
 *
 * Regions are keyed by TDWG Level-3 code throughout. `area` is a display label taken from the
 * published dataset — names change between vintages, codes do not.
 *
 * Opened once at first request; reused for the lifetime of the process.
 * Each request opens its own lightweight Connection and closes it in finally.
 */

import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb') as typeof import('duckdb');

const DB_PATH_ENV = process.env.DATABASE_PATH?.trim();
const DB_PATH = DB_PATH_ENV
	? path.resolve(DB_PATH_ENV)
	: path.resolve(process.cwd(), 'data/wcfp.duckdb');

// ── Singleton ────────────────────────────────────────────────────────────────

let _db: import('duckdb').Database | null = null;
// Guard against simultaneous first-request races
let _dbInitializing = false;

function getDB(): import('duckdb').Database {
	if (_db) return _db;
	if (_dbInitializing) {
		// Spin briefly — only possible on true parallel first requests
		throw new Error('Database is initializing, please retry');
	}
	_dbInitializing = true;
	try {
		_db = new duckdb.Database(DB_PATH, { access_mode: 'READ_ONLY' });
		return _db;
	} catch (err) {
		_dbInitializing = false;
		throw new Error(
			`Failed to open DuckDB at "${DB_PATH}". ` +
				`Run "pnpm build:db" to generate the database. ` +
				`Original error: ${err instanceof Error ? err.message : String(err)}`
		);
	} finally {
		_dbInitializing = false;
	}
}

// ── Connection ───────────────────────────────────────────────────────────────

/**
 * Open a new connection. Pass `{ spatial: true }` only for endpoints that use
 * spatial SQL functions (ST_AsGeoJSON etc.). All other callers should pass
 * `{ spatial: false }` to skip the per-connection LOAD overhead.
 * Caller MUST close it: `conn.close()` — ideally in a try/finally.
 */
export async function getConnection(options?: {
	spatial?: boolean;
}): Promise<import('duckdb').Connection> {
	const conn = getDB().connect();
	if (options?.spatial !== false) {
		// LOAD spatial must be called per-connection; the extension was installed at build time
		try {
			await new Promise<void>((resolve, reject) =>
				conn.run('LOAD spatial', (err) => (err ? reject(err) : resolve()))
			);
		} catch (err) {
			conn.close();
			throw new Error(
				`Failed to load spatial extension: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
	return conn;
}

// ── Non-spatial connection pool ───────────────────────────────────────────────
// Taxonomy and other non-geo queries reuse pooled connections instead of
// creating/closing one per request, removing the per-request creation overhead.

const ENABLE_CONNECTION_POOL = process.env.NODE_ENV === 'production';
const POOL_SIZE = 6;
const _pool: import('duckdb').Connection[] = [];

/**
 * Borrow a non-spatial connection from the pool. Call `releasePooledConnection`
 * when done — do NOT call `.close()` on it.
 */
export function borrowConnection(): import('duckdb').Connection {
	if (!ENABLE_CONNECTION_POOL) {
		return getDB().connect();
	}

	return _pool.pop() ?? getDB().connect();
}

/**
 * Return a connection to the pool. If the pool is full the connection is closed.
 */
export function releaseConnection(conn: import('duckdb').Connection): void {
	if (!ENABLE_CONNECTION_POOL) {
		conn.close();
		return;
	}

	if (_pool.length < POOL_SIZE) {
		_pool.push(conn);
	} else {
		conn.close();
	}
}

/** Drain and close all pooled connections (called on DB reset). */
export function drainPool(): void {
	let conn: import('duckdb').Connection | undefined;
	while ((conn = _pool.pop())) {
		conn.close();
	}
}

export async function resetDatabase(): Promise<void> {
	if (!_db) {
		return;
	}

	drainPool();
	const currentDb = _db;
	_db = null;

	await new Promise<void>((resolve, reject) => {
		currentDb.close((err: Error | null) => {
			if (err) {
				reject(err);
				return;
			}

			resolve();
		});
	});
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/**
 * Recursively convert BigInt → Number (safe for values ≤ Number.MAX_SAFE_INTEGER).
 * DuckDB returns COUNT(*) and similar aggregates as BigInt.
 */
function normalizeBigInt(value: unknown): unknown {
	if (typeof value === 'bigint') {
		if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
			// Preserve precision as string rather than silently losing it
			return value.toString();
		}
		return Number(value);
	}
	if (Array.isArray(value)) return value.map(normalizeBigInt);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeBigInt(v)])
		);
	}
	return value;
}

/**
 * Execute a parameterized SQL query and return typed rows.
 *
 * @example
 * const rows = await query<{ area: string; count: number }>(
 *   conn,
 *   `SELECT area, COUNT(*) AS count FROM distribution WHERE wcfp_id = ?`,
 *   [wcfpId]
 * );
 */
export function query<T>(
	conn: import('duckdb').Connection,
	sql: string,
	params: unknown[] = []
): Promise<T[]> {
	return new Promise((resolve, reject) => {
		conn.all(sql, ...params, (err: Error | null, rows: unknown[]) => {
			if (err) reject(err);
			else resolve(normalizeBigInt(rows) as T[]);
		});
	});
}

/**
 * Execute a SQL statement (no return value).
 */
export function run(conn: import('duckdb').Connection, sql: string): Promise<void> {
	return new Promise((resolve, reject) => {
		conn.run(sql, (err: Error | null) => {
			if (err) reject(err);
			else resolve();
		});
	});
}
