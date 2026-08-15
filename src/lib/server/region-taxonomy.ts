import { borrowConnection, releaseConnection, resetDatabase } from './database.js';
import {
	getRegionStats,
	getStatusFacets,
	getRegionTaxonomyAvailableLifeforms,
	getRegionTaxonomyFamilyRows,
	getRegionTaxonomyGenusRows,
	getRegionTaxonomyGenusRowsByStatus,
	getRegionTaxonomySpeciesRows,
	queryRegionTaxonomyMatchedFamilies,
	queryRegionTaxonomyMatchedGenera,
	queryRegionTaxonomyMatchedSpecies,
	type OccurrenceStatus,
	type RegionTaxonomyFamilyRow,
	type RegionTaxonomyGenusRow,
	type SpeciesRow
} from './queries.js';
import type {
	TaxonomyBootstrapPayload,
	TaxonomyChildrenPayload,
	TaxonomyNodeNormalized,
	TaxonomyQueryPayload
} from '$lib/types/taxonomy';
import { SPECIES_USE_ORDER } from '$lib/constants/portal-help';
import type { SpeciesUseKey } from '$lib/types/species';

const ROOT_ID = 'region-root';

interface RegionTaxonomyMeta {
	startFromId: string;
	availableLifeforms: string[];
}

function isMissingRegionTaxonomySchemaError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return (
		error.message.includes('region_family_taxonomy') ||
		error.message.includes('region_genus_taxonomy')
	);
}

function buildOutdatedRegionTaxonomySchemaError(error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error);
	return new Error(
		`Region taxonomy DB schema is outdated. Run "pnpm refresh:data" and restart the server. Original error: ${message}`
	);
}

async function withRegionTaxonomySchemaRecovery<T>(operation: () => Promise<T>): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (!isMissingRegionTaxonomySchemaError(error)) {
			throw error;
		}

		clearRegionTaxonomyCache();
		await resetDatabase();

		try {
			return await operation();
		} catch (retryError) {
			if (isMissingRegionTaxonomySchemaError(retryError)) {
				throw buildOutdatedRegionTaxonomySchemaError(retryError);
			}

			throw retryError;
		}
	}
}

function encodeSegment(value: string): string {
	return encodeURIComponent(value.trim());
}

function decodeSegment(value: string): string {
	return decodeURIComponent(value);
}

function normalizeTaxonomyValue(value: string | null | undefined): string {
	const trimmed = value?.trim();
	return trimmed ? trimmed : 'Unknown';
}

function buildFamilyId(family: string): string {
	return `${ROOT_ID}/family/${encodeSegment(family)}`;
}

function buildGenusId(family: string, genus: string): string {
	return `${buildFamilyId(family)}/genus/${encodeSegment(genus)}`;
}

function buildSpeciesId(family: string, genus: string, wcfpId: number): string {
	return `${buildGenusId(family, genus)}/species/${wcfpId}`;
}

function createRootNode(totalSpeciesCount: number, familyCount: number): TaxonomyNodeNormalized {
	return {
		id: ROOT_ID,
		name: 'Taxonomy',
		nameLower: 'taxonomy',
		rank: 'root',
		count: totalSpeciesCount,
		childCount: familyCount,
		childrenIds: [],
		childrenLoaded: true,
		parentId: null,
		path: ROOT_ID,
		depth: 0,
		hasDistribution: totalSpeciesCount > 0
	};
}

function createFamilyNode(row: RegionTaxonomyFamilyRow): TaxonomyNodeNormalized {
	const family = normalizeTaxonomyValue(row.family);

	return {
		id: buildFamilyId(family),
		name: family,
		nameLower: family.toLowerCase(),
		rank: 'family',
		count: row.species_count,
		childCount: row.genus_count,
		childrenIds: [],
		childrenLoaded: false,
		parentId: ROOT_ID,
		path: buildFamilyId(family),
		depth: 1,
		hasDistribution: row.species_count > 0
	};
}

function createGenusNode(row: RegionTaxonomyGenusRow): TaxonomyNodeNormalized {
	const family = normalizeTaxonomyValue(row.family);
	const genus = normalizeTaxonomyValue(row.genus);

	return {
		id: buildGenusId(family, genus),
		name: genus,
		nameLower: genus.toLowerCase(),
		rank: 'genus',
		count: row.species_count,
		childCount: row.species_count,
		childrenIds: [],
		childrenLoaded: false,
		parentId: buildFamilyId(family),
		path: buildGenusId(family, genus),
		depth: 2,
		hasDistribution: row.species_count > 0
	};
}

function createSpeciesNode(row: SpeciesRow): TaxonomyNodeNormalized {
	const family = normalizeTaxonomyValue(row.family);
	const genus = normalizeTaxonomyValue(row.genus);
	const uses = SPECIES_USE_ORDER.filter((useKey) =>
		Boolean(
			({
				humanFood: row.use_human_food,
				animalFood: row.use_animal_food,
				environmentalUses: row.use_environmental,
				fuels: row.use_fuels,
				geneSources: row.use_gene_sources,
				invertebrateFood: row.use_invertebrate_food,
				materials: row.use_materials,
				medicines: row.use_medicines,
				poisons: row.use_poisons,
				socialUses: row.use_social_uses
			} as Record<SpeciesUseKey, boolean>)[useKey]
		)
	);
	const lifeforms = row.lifeform?.trim() ? [row.lifeform.trim()] : [];
	const hasCwr = row.cwr || undefined;
	const occurrenceStatus = row.occurrence_status;

	return {
		id: buildSpeciesId(family, genus, row.wcfp_id),
		name: row.taxon_name,
		nameLower: row.taxon_name.toLowerCase(),
		rank: 'species',
		count: 1,
		childCount: 0,
		childrenIds: [],
		childrenLoaded: true,
		parentId: buildGenusId(family, genus),
		path: buildSpeciesId(family, genus, row.wcfp_id),
		depth: 3,
		wcfpId: row.wcfp_id,
		...(row.authors ? { authors: row.authors } : {}),
		hasDistribution: true,
		...(lifeforms.length > 0 || uses.length > 0 || hasCwr || occurrenceStatus
			? {
					traits: {
						...(occurrenceStatus ? { occurrenceStatus } : {}),
						lifeforms,
						uses,
						...(hasCwr ? { hasCwr } : {})
					}
				}
			: {})
	};
}

function finalizeProjectedNodes(
	nodes: readonly TaxonomyNodeNormalized[],
	options: { forceLoaded?: boolean } = {}
): TaxonomyNodeNormalized[] {
	const includedIds = new Set(nodes.map((node) => node.id));
	const parentsWithIncludedChildren = new Set<string>();

	for (const node of nodes) {
		if (node.parentId && includedIds.has(node.parentId)) {
			parentsWithIncludedChildren.add(node.parentId);
		}
	}

	return nodes.map((node) => ({
		...node,
		childrenLoaded:
			options.forceLoaded === true
				? true
				: node.childCount === 0 || parentsWithIncludedChildren.has(node.id)
	}));
}

function buildExpandedIds(
	nodes: readonly TaxonomyNodeNormalized[],
	startFromId: string
): string[] {
	const includedIds = new Set(nodes.map((node) => node.id));
	const expanded = new Set<string>();

	for (const node of nodes) {
		if (node.parentId && includedIds.has(node.parentId)) {
			expanded.add(node.parentId);
		}
	}

	return [...expanded].filter((id) => id !== ROOT_ID || startFromId === ROOT_ID);
}

function parseParentId(parentId: string):
	| { rank: 'root' }
	| { rank: 'family'; family: string }
	| { rank: 'genus'; family: string; genus: string }
	| null {
	if (parentId === ROOT_ID) {
		return { rank: 'root' };
	}

	const familyMatch = parentId.match(/^region-root\/family\/([^/]+)$/);
	if (familyMatch?.[1]) {
		return { rank: 'family', family: decodeSegment(familyMatch[1]) };
	}

	const genusMatch = parentId.match(/^region-root\/family\/([^/]+)\/genus\/([^/]+)$/);
	if (genusMatch?.[1] && genusMatch[2]) {
		return {
			rank: 'genus',
			family: decodeSegment(genusMatch[1]),
			genus: decodeSegment(genusMatch[2])
		};
	}

	return null;
}

const metaCache = new Map<string, RegionTaxonomyMeta>();
const metaPromiseCache = new Map<string, Promise<RegionTaxonomyMeta>>();
const bootstrapCache = new Map<string, TaxonomyBootstrapPayload>();
const bootstrapPromiseCache = new Map<string, Promise<TaxonomyBootstrapPayload>>();
const childrenInflight = new Map<string, Promise<TaxonomyChildrenPayload>>();

export function clearRegionTaxonomyCache(): void {
	metaCache.clear();
	metaPromiseCache.clear();
	bootstrapCache.clear();
	bootstrapPromiseCache.clear();
	childrenInflight.clear();
}

async function loadRegionMeta(code: string): Promise<RegionTaxonomyMeta> {
	return withRegionTaxonomySchemaRecovery(async () => {
		const conn = borrowConnection();

		try {
			const availableLifeforms = await getRegionTaxonomyAvailableLifeforms(conn, code);
			return {
				startFromId: ROOT_ID,
				availableLifeforms
			};
		} finally {
			releaseConnection(conn);
		}
	});
}

async function getRegionMeta(code: string): Promise<RegionTaxonomyMeta> {
	const cached = metaCache.get(code);
	if (cached) {
		return cached;
	}

	const inflight = metaPromiseCache.get(code);
	if (inflight) {
		return inflight;
	}

	const promise = loadRegionMeta(code)
		.then((meta) => {
			metaCache.set(code, meta);
			return meta;
		})
		.finally(() => {
			metaPromiseCache.delete(code);
		});

	metaPromiseCache.set(code, promise);
	return promise;
}

async function loadRegionBootstrap(
	code: string,
	status: OccurrenceStatus | null = null
): Promise<TaxonomyBootstrapPayload> {
	return withRegionTaxonomySchemaRecovery(async () => {
		const conn = borrowConnection();

		try {
			const [meta, stats, familyRows, facets] = await Promise.all([
				getRegionMeta(code),
				getRegionStats(conn, code),
				getRegionTaxonomyFamilyRows(conn, code, status),
				status ? getStatusFacets(conn, code) : Promise.resolve(null)
			]);

			const totalSpeciesCount = facets
				? (facets.find((f) => f.occurrence_status === status)?.count ?? 0)
				: (stats?.total_species ?? 0);
			const rootNode = createRootNode(totalSpeciesCount, familyRows.length);
			const familyNodes = familyRows.map((row) => createFamilyNode(row));
			const nodes = finalizeProjectedNodes([rootNode, ...familyNodes]);

			return {
				rootId: ROOT_ID,
				startFromId: meta.startFromId,
				expandedIds: [ROOT_ID],
				availableLifeforms: meta.availableLifeforms,
				nodes
			};
		} finally {
			releaseConnection(conn);
		}
	});
}

export async function getRegionTaxonomyBootstrap(
	code: string,
	status: OccurrenceStatus | null = null
): Promise<TaxonomyBootstrapPayload> {
	// Cache per (region, status) — the unfiltered payload is not a valid answer for a filter.
	const key = status ? `${code}::${status}` : code;
	const cached = bootstrapCache.get(key);
	if (cached) {
		return cached;
	}

	const inflight = bootstrapPromiseCache.get(key);
	if (inflight) {
		return inflight;
	}

	const promise = loadRegionBootstrap(code, status)
		.then((payload) => {
			bootstrapCache.set(key, payload);
			return payload;
		})
		.finally(() => {
			bootstrapPromiseCache.delete(key);
		});

	bootstrapPromiseCache.set(key, promise);
	return promise;
}

export async function getRegionTaxonomyChildren(
	code: string,
	parentId: string,
	status: OccurrenceStatus | null = null
): Promise<TaxonomyChildrenPayload> {
	const key = status ? `${code}::${status}::${parentId}` : `${code}::${parentId}`;
	const inflight = childrenInflight.get(key);
	if (inflight) {
		return inflight;
	}

	const promise = withRegionTaxonomySchemaRecovery(async () => {
		const conn = borrowConnection();

		try {
			const parent = parseParentId(parentId);
			if (!parent) {
				return { parentId, nodes: [] };
			}

			if (parent.rank === 'root') {
				const familyRows = await getRegionTaxonomyFamilyRows(conn, code, status);
				return {
					parentId,
					nodes: familyRows.map((row) => createFamilyNode(row))
				};
			}

			if (parent.rank === 'family') {
				const genusRows = status
					? await getRegionTaxonomyGenusRowsByStatus(conn, code, parent.family, status)
					: await getRegionTaxonomyGenusRows(conn, code, parent.family);
				return {
					parentId,
					nodes: genusRows.map((row) => createGenusNode(row))
				};
			}

			const speciesRows = await getRegionTaxonomySpeciesRows(
				conn,
				code,
				parent.family,
				parent.genus,
				status
			);
			return {
				parentId,
				nodes: speciesRows.map((row) => createSpeciesNode(row))
			};
		} finally {
			releaseConnection(conn);
		}
	}).finally(() => {
		childrenInflight.delete(key);
	});

	childrenInflight.set(key, promise);
	return promise;
}

export async function queryRegionTaxonomy(
	code: string,
	params: {
		q?: string;
		geographicOnly?: boolean;
		lifeforms?: string[];
		uses?: SpeciesUseKey[];
		occurrenceStatus?: OccurrenceStatus | null;
	}
): Promise<TaxonomyQueryPayload> {
	return withRegionTaxonomySchemaRecovery(async () => {
		const conn = borrowConnection();

		try {
			const [meta, stats, facets] = await Promise.all([
				getRegionMeta(code),
				getRegionStats(conn, code),
				params.occurrenceStatus ? getStatusFacets(conn, code) : Promise.resolve(null)
			]);
			const scopedCount = facets
				? (facets.find((f) => f.occurrence_status === params.occurrenceStatus)?.count ?? 0)
				: (stats?.total_species ?? 0);
			const rootNode = createRootNode(scopedCount, stats?.family_count ?? 0);
			const searchQuery = params.q?.trim() ?? '';
			const hasTraitFilters =
				Boolean(params.geographicOnly) ||
				Boolean(params.lifeforms?.length) ||
				Boolean(params.uses?.length) ||
				Boolean(params.occurrenceStatus);
			// Family counts must reflect the filter too, or the tree sits under a header that
			// counts taxa it is not showing.
			const familyRows = await getRegionTaxonomyFamilyRows(
				conn,
				code,
				params.occurrenceStatus ?? null
			);
			const familyByName = new Map(
				familyRows.map((row) => [normalizeTaxonomyValue(row.family), row] as const)
			);
			const genusByKey = new Map<string, RegionTaxonomyGenusRow>();

			const nodesById = new Map<string, TaxonomyNodeNormalized>();

			function includeNode(node: TaxonomyNodeNormalized) {
				if (!nodesById.has(node.id)) {
					nodesById.set(node.id, node);
				}
			}

			async function getGenusRow(family: string, genus: string): Promise<RegionTaxonomyGenusRow | null> {
				const key = `${family}::${genus}`;
				const cached = genusByKey.get(key);
				if (cached) {
					return cached;
				}

				const genusRows = await getRegionTaxonomyGenusRows(conn, code, family);
				for (const row of genusRows) {
					genusByKey.set(
						`${normalizeTaxonomyValue(row.family)}::${normalizeTaxonomyValue(row.genus)}`,
						row
					);
				}

				return genusByKey.get(key) ?? null;
			}

			async function includeSpeciesRow(row: SpeciesRow) {
				const familyName = normalizeTaxonomyValue(row.family);
				const genusName = normalizeTaxonomyValue(row.genus);
				const familyNode = createFamilyNode(
					familyByName.get(familyName) ?? {
						family: familyName,
						species_count: 1,
						genus_count: 1
					}
				);
				const genusNode = createGenusNode(
					(await getGenusRow(familyName, genusName)) ?? {
						family: familyName,
						genus: genusName,
						species_count: 1
					}
				);
				const speciesNode = createSpeciesNode(row);

				includeNode(rootNode);
				includeNode(familyNode);
				includeNode(genusNode);
				includeNode(speciesNode);
			}

			if (hasTraitFilters) {
				const matchedSpecies = await queryRegionTaxonomyMatchedSpecies(conn, code, params);
				for (const row of matchedSpecies) {
					await includeSpeciesRow(row);
				}
			} else if (searchQuery) {
				const [matchedFamilies, matchedGenera, matchedSpecies] = await Promise.all([
					queryRegionTaxonomyMatchedFamilies(conn, code, searchQuery),
					queryRegionTaxonomyMatchedGenera(conn, code, searchQuery),
					queryRegionTaxonomyMatchedSpecies(conn, code, {
						q: searchQuery,
						includeTaxonomyNameMatches: false
					})
				]);

				for (const row of matchedFamilies) {
					includeNode(rootNode);
					includeNode(createFamilyNode(row));
				}

				for (const row of matchedGenera) {
					includeNode(rootNode);
					includeNode(
						createFamilyNode(
							familyByName.get(normalizeTaxonomyValue(row.family)) ?? {
								family: row.family,
								species_count: row.species_count,
								genus_count: 1
							}
						)
					);
					includeNode(createGenusNode(row));
				}

				for (const row of matchedSpecies) {
					await includeSpeciesRow(row);
				}
			}

			const nodes = finalizeProjectedNodes(
				[...nodesById.values()].sort(
					(left, right) => left.depth - right.depth || left.name.localeCompare(right.name)
				),
				{ forceLoaded: true }
			);

			return {
				rootId: ROOT_ID,
				startFromId: meta.startFromId,
				expandedIds: buildExpandedIds(nodes, meta.startFromId),
				nodes
			};
		} finally {
			releaseConnection(conn);
		}
	});
}
