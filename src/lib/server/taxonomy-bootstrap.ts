import { resetDatabase, borrowConnection, releaseConnection } from './database.js';
import {
	getInitialTaxonomyRows,
	getTaxonomyAvailableLifeforms,
	getTaxonomyChildrenRows,
	getTaxonomyStartNodeId,
	mapTaxonomyNodeRow,
	queryTaxonomyRows
} from './queries.js';
import type {
	TaxonomyBootstrapPayload,
	TaxonomyChildrenPayload,
	TaxonomyNodeNormalized,
	TaxonomyQueryPayload
} from '$lib/types/taxonomy';
import type { SpeciesUseKey } from '$lib/types/species';

interface TaxonomyRuntimeMeta {
	rootId: string;
	startFromId: string;
	availableLifeforms: string[];
}

const ROOT_ID = 'root';

let cachedMeta: TaxonomyRuntimeMeta | null = null;
let metaPromise: Promise<TaxonomyRuntimeMeta> | null = null;
let cachedBootstrap: TaxonomyBootstrapPayload | null = null;
let bootstrapPromise: Promise<TaxonomyBootstrapPayload> | null = null;
const childrenInflight = new Map<string, Promise<TaxonomyChildrenPayload>>();

function isMissingTaxonomySchemaError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return error.message.includes('taxonomy_nodes') || error.message.includes('taxonomy_closure');
}

function buildOutdatedTaxonomySchemaError(error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error);
	return new Error(
		`Taxonomy DB schema is outdated. Run "pnpm refresh:data" and restart the server. Original error: ${message}`
	);
}

async function withTaxonomySchemaRecovery<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (!isMissingTaxonomySchemaError(error)) {
			throw error;
		}

		clearTaxonomyBootstrapCache();
		await resetDatabase();

		try {
			return await operation();
		} catch (retryError) {
			if (isMissingTaxonomySchemaError(retryError)) {
				throw buildOutdatedTaxonomySchemaError(retryError);
			}

			throw retryError;
		}
	}
}

function finalizeProjectedNodes(
	rows: readonly ReturnType<typeof mapTaxonomyNodeRow>[],
	options: { forceLoaded?: boolean } = {}
) {
	const includedIds = new Set(rows.map((row) => row.id));
	const parentsWithIncludedChildren = new Set<string>();

	for (const row of rows) {
		if (row.parentId && includedIds.has(row.parentId)) {
			parentsWithIncludedChildren.add(row.parentId);
		}
	}

	return rows.map((row) => ({
		...row,
		childrenLoaded:
			options.forceLoaded === true
				? true
				: row.childCount === 0 || parentsWithIncludedChildren.has(row.id)
	}));
}

function buildExpandedIds(nodes: readonly TaxonomyNodeNormalized[], startFromId: string): string[] {
	const includedIds = new Set(nodes.map((node) => node.id));
	const expanded = new Set<string>();

	for (const node of nodes) {
		if (node.parentId && includedIds.has(node.parentId)) {
			expanded.add(node.parentId);
		}
	}

	if (!includedIds.has(startFromId)) {
		return [];
	}

	return [...expanded].filter((id) => id !== ROOT_ID || startFromId === ROOT_ID);
}

async function loadTaxonomyMeta(): Promise<TaxonomyRuntimeMeta> {
	return withTaxonomySchemaRecovery(async () => {
		const conn = borrowConnection();

		try {
			const [startFromId, availableLifeforms] = await Promise.all([
				getTaxonomyStartNodeId(conn),
				getTaxonomyAvailableLifeforms(conn)
			]);

			return {
				rootId: ROOT_ID,
				startFromId,
				availableLifeforms
			};
		} finally {
			releaseConnection(conn);
		}
	});
}

async function getTaxonomyMeta(): Promise<TaxonomyRuntimeMeta> {
	if (cachedMeta) {
		return cachedMeta;
	}

	if (metaPromise) {
		return metaPromise;
	}

	metaPromise = loadTaxonomyMeta()
		.then((meta) => {
			cachedMeta = meta;
			return meta;
		})
		.finally(() => {
			metaPromise = null;
		});

	return metaPromise;
}

async function loadTaxonomyBootstrap(): Promise<TaxonomyBootstrapPayload> {
	return withTaxonomySchemaRecovery(async () => {
		const meta = await getTaxonomyMeta();
		const conn = borrowConnection();

		try {
			const rows = await getInitialTaxonomyRows(conn, 3);
			const nodes = finalizeProjectedNodes(rows.map((row) => mapTaxonomyNodeRow(row)));

			return {
				rootId: meta.rootId,
				startFromId: meta.startFromId,
				expandedIds: buildExpandedIds(nodes, meta.startFromId),
				availableLifeforms: meta.availableLifeforms,
				nodes
			};
		} finally {
			releaseConnection(conn);
		}
	});
}

export async function getTaxonomyBootstrap(): Promise<TaxonomyBootstrapPayload> {
	if (cachedBootstrap) {
		return cachedBootstrap;
	}

	if (bootstrapPromise) {
		return bootstrapPromise;
	}

	bootstrapPromise = loadTaxonomyBootstrap()
		.then((payload) => {
			cachedBootstrap = payload;
			return payload;
		})
		.finally(() => {
			bootstrapPromise = null;
		});

	return bootstrapPromise;
}

export async function getTaxonomyChildren(parentId: string): Promise<TaxonomyChildrenPayload> {
	const existing = childrenInflight.get(parentId);
	if (existing) return existing;

	const promise = withTaxonomySchemaRecovery(async () => {
		const conn = borrowConnection();

		try {
			const rows = await getTaxonomyChildrenRows(conn, parentId);
			return {
				parentId,
				nodes: rows.map((row) => mapTaxonomyNodeRow(row))
			};
		} finally {
			releaseConnection(conn);
		}
	}).finally(() => childrenInflight.delete(parentId));

	childrenInflight.set(parentId, promise);
	return promise;
}

export async function queryTaxonomy(params: {
	q?: string;
	geographicOnly?: boolean;
	lifeforms?: string[];
	uses?: SpeciesUseKey[];
}): Promise<TaxonomyQueryPayload> {
	return withTaxonomySchemaRecovery(async () => {
		const t0 = Date.now();
		const meta = await getTaxonomyMeta();
		const t1 = Date.now();
		const conn = borrowConnection();
		const t2 = Date.now();

		try {
			const rows = await queryTaxonomyRows(conn, params);
			const t3 = Date.now();
			const nodes = finalizeProjectedNodes(
				rows.map((row) => mapTaxonomyNodeRow(row)),
				{ forceLoaded: true }
			);
			const expandedIds = buildExpandedIds(nodes, meta.startFromId);
			const t4 = Date.now();

			console.log(
				`[queryTaxonomy] meta=${t1 - t0}ms conn=${t2 - t1}ms sql=${t3 - t2}ms post=${t4 - t3}ms TOTAL=${t4 - t0}ms rows=${rows.length} nodes=${nodes.length}`
			);

			return {
				rootId: meta.rootId,
				startFromId: meta.startFromId,
				expandedIds,
				nodes
			};
		} finally {
			releaseConnection(conn);
		}
	});
}

export function clearTaxonomyBootstrapCache(): void {
	cachedMeta = null;
	metaPromise = null;
	cachedBootstrap = null;
	bootstrapPromise = null;
}
