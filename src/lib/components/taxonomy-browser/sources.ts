import { base } from '$app/paths';
import type {
	TaxonomyBootstrapPayload,
	TaxonomyChildrenPayload,
	TaxonomyQueryPayload
} from '$lib/types/taxonomy';
import type { TaxonomyBrowserQuery, TaxonomyBrowserSource } from '$lib/types/taxonomy-browser';
import { serializeTaxonomyBrowserQuery } from '$lib/types/taxonomy-browser';
import { profileApiQuery } from '$lib/utils/api-profiler';

function readApiData<T>(url: string, signal?: AbortSignal): Promise<T> {
	return profileApiQuery(url, async () => {
		const response = await fetch(url, { signal });

		if (!response.ok) {
			let message = `Request failed: ${response.status}`;

			try {
				const payload = (await response.json()) as { message?: string };
				if (payload?.message) {
					message = payload.message;
				}
			} catch {
				// Keep the generic error if the payload is not JSON.
			}

			throw new Error(message);
		}

		const payload = (await response.json()) as { data: T };
		return payload.data;
	});
}

/**
 * @param scopeQuery A pre-encoded `?key=value` applied to browse requests, used to keep a
 *   region-wide scope filter on bootstrap and children as well as query.
 */
function createApiTaxonomySource(basePath: string, scopeQuery = ''): TaxonomyBrowserSource {
	const scopeParam = scopeQuery.replace(/^\?/, '');
	const join = (path: string) =>
		scopeParam ? `${path}${path.includes('?') ? '&' : '?'}${scopeParam}` : path;

	return {
		loadBootstrap: (signal) =>
			readApiData<TaxonomyBootstrapPayload>(join(`${basePath}/bootstrap`), signal),
		loadChildren: (parentId, signal) =>
			readApiData<TaxonomyChildrenPayload>(
				join(`${basePath}/children?parentId=${encodeURIComponent(parentId)}`),
				signal
			),
		query: (query, signal) => {
			const queryString = serializeTaxonomyBrowserQuery(query);
			return readApiData<TaxonomyQueryPayload>(join(`${basePath}/query?${queryString}`), signal);
		}
	};
}

export function createGlobalTaxonomySource(): TaxonomyBrowserSource {
	return createApiTaxonomySource(`${base}/api/v1/taxonomy`);
}

/**
 * @param regionCode TDWG Level-3 code, e.g. `ITA`.
 * @param status Occurrence status to restrict the whole tree to, or null for every record.
 *   Passed on the URL so bootstrap and lazily-loaded children stay consistent — expanding a
 *   family must not reintroduce taxa the filter excluded.
 */
export function createRegionTaxonomySource(
	regionCode: string,
	status?: string | null
): TaxonomyBrowserSource {
	const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
	return {
		key: regionCode,
		scopeKey: status ?? '',
		...createApiTaxonomySource(
			`${base}/api/v1/regions/${encodeURIComponent(regionCode)}/taxonomy`,
			suffix
		)
	};
}

export type { TaxonomyBrowserQuery };
