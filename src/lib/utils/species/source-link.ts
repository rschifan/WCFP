/**
 * The registry behind a taxon's `Link` column.
 *
 * Every record in the published workbook carries one, and all of them point at one of four
 * registries — IPNI for vascular plants, AlgaeBase for algae, with a handful on Tropicos and GBIF.
 * Naming the registry is the difference between "open source link" and a citation the reader can
 * judge before clicking.
 */

const SOURCE_NAMES: ReadonlyArray<readonly [host: string, name: string]> = [
	['ipni.org', 'IPNI'],
	['algaebase.org', 'AlgaeBase'],
	['tropicos.org', 'Tropicos'],
	['gbif.org', 'GBIF']
];

/** Registry name for a taxonomic source URL, or `null` when the host is not one we know. */
export function getSourceName(url: string | null | undefined): string | null {
	if (!url) return null;
	const match = SOURCE_NAMES.find(([host]) => url.includes(host));
	return match ? match[1] : null;
}

/** Link text for a source URL — named when we recognise the registry, generic when we do not. */
export function getSourceLinkLabel(url: string | null | undefined): string {
	const name = getSourceName(url);
	return name ? `View on ${name}` : 'Open source link';
}

/**
 * The registry's own record id, so the source can be cited as "IPNI 600841-1" rather than as a
 * bare URL. Each registry puts it somewhere different — a path segment for IPNI, Tropicos and
 * GBIF, a query parameter for AlgaeBase.
 */
export function getSourceRecordId(url: string | null | undefined): string | null {
	if (!url) return null;

	try {
		const parsed = new URL(url);
		const fromQuery = parsed.searchParams.get('species_id') ?? parsed.searchParams.get('id');
		if (fromQuery) return fromQuery;

		const segments = parsed.pathname.split('/').filter(Boolean);
		return segments.at(-1) ?? null;
	} catch {
		return null;
	}
}

/** "IPNI 600841-1" when both parts are known, otherwise whichever half we have. */
export function getSourceCitation(url: string | null | undefined): string | null {
	const name = getSourceName(url);
	const id = getSourceRecordId(url);
	if (name && id) return `${name} ${id}`;
	return name ?? id;
}
