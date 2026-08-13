import type { Handle } from '@sveltejs/kit';
import { base } from '$app/paths';

export const MAX_LOGGED_RESPONSE_BODY_BYTES = 4096;

function formatDuration(durationMs: number): string {
	return `${durationMs.toFixed(1)}ms`;
}

function isPreviewableContentType(contentType: string | null): boolean {
	return Boolean(contentType?.includes('application/json') || contentType?.startsWith('text/'));
}

export function formatResponseBodyPreview(bodyText: string, contentType: string | null): string {
	if (!bodyText) {
		return '<empty>';
	}

	if (contentType?.includes('application/json')) {
		try {
			return JSON.stringify(JSON.parse(bodyText), null, 2);
		} catch {
			return bodyText;
		}
	}

	return bodyText;
}

export function getErrorResponseBodyPreviewPolicy(
	status: number,
	contentType: string | null,
	contentLength: string | null
): { shouldReadBody: boolean; omissionReason: string | null } {
	if (status < 400) {
		return { shouldReadBody: false, omissionReason: null };
	}

	if (!isPreviewableContentType(contentType)) {
		return {
			shouldReadBody: false,
			omissionReason: `<body omitted: unsupported content-type${contentType ? ` (${contentType})` : ''}>`
		};
	}

	if (contentLength === null) {
		return {
			shouldReadBody: false,
			omissionReason: '<body omitted: content-length unavailable>'
		};
	}

	const parsedLength = Number.parseInt(contentLength, 10);
	if (!Number.isFinite(parsedLength)) {
		return {
			shouldReadBody: false,
			omissionReason: `<body omitted: invalid content-length (${contentLength})>`
		};
	}

	if (parsedLength > MAX_LOGGED_RESPONSE_BODY_BYTES) {
		return {
			shouldReadBody: false,
			omissionReason: `<body omitted: content-length ${parsedLength} exceeds ${MAX_LOGGED_RESPONSE_BODY_BYTES} bytes>`
		};
	}

	return { shouldReadBody: true, omissionReason: null };
}

export async function getErrorResponseBodyPreview(
	response: Pick<Response, 'status' | 'headers' | 'clone'>
): Promise<string | null> {
	const contentType = response.headers.get('content-type');
	const policy = getErrorResponseBodyPreviewPolicy(
		response.status,
		contentType,
		response.headers.get('content-length')
	);

	if (!policy.shouldReadBody) {
		return policy.omissionReason;
	}

	const bodyText = await response.clone().text();
	return formatResponseBodyPreview(bodyText, contentType);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!event.url.pathname.startsWith(`${base}/api/`)) {
		return resolve(event);
	}

	const startedAt = performance.now();

	try {
		const response = await resolve(event);
		const duration = performance.now() - startedAt;
		const summary = `[api] ${event.request.method} ${event.url.pathname}${event.url.search} -> ${response.status} in ${formatDuration(duration)}`;

		if (response.status >= 400) {
			const preview = await getErrorResponseBodyPreview(response);
			console.error(preview ? `${summary}\n${preview}` : summary);
			return response;
		}

		console.log(summary);

		return response;
	} catch (error) {
		console.error(
			`[api] ${event.request.method} ${event.url.pathname}${event.url.search} failed in ${formatDuration(
				performance.now() - startedAt
			)}`,
			error
		);
		throw error;
	}
};
