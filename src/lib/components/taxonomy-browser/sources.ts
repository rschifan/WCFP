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

function createApiTaxonomySource(basePath: string): TaxonomyBrowserSource {
	return {
		loadBootstrap: (signal) =>
			readApiData<TaxonomyBootstrapPayload>(`${basePath}/bootstrap`, signal),
		loadChildren: (parentId, signal) =>
			readApiData<TaxonomyChildrenPayload>(
				`${basePath}/children?parentId=${encodeURIComponent(parentId)}`,
				signal
			),
		query: (query, signal) => {
			const queryString = serializeTaxonomyBrowserQuery(query);
			return readApiData<TaxonomyQueryPayload>(`${basePath}/query?${queryString}`, signal);
		}
	};
}

export function createGlobalTaxonomySource(): TaxonomyBrowserSource {
	return createApiTaxonomySource(`${base}/api/v1/taxonomy`);
}

export function createRegionTaxonomySource(regionName: string): TaxonomyBrowserSource {
	return createApiTaxonomySource(
		`${base}/api/v1/regions/${encodeURIComponent(regionName)}/taxonomy`
	);
}

export type { TaxonomyBrowserQuery };
