import { describe, expect, it, vi } from 'vitest';
import {
	MAX_LOGGED_RESPONSE_BODY_BYTES,
	getErrorResponseBodyPreview,
	getErrorResponseBodyPreviewPolicy
} from './hooks.server';

describe('hooks.server API logging helpers', () => {
	it('does not inspect successful response bodies', async () => {
		const clone = vi.fn();

		const preview = await getErrorResponseBodyPreview({
			status: 200,
			headers: new Headers({
				'content-type': 'application/json',
				'content-length': '18'
			}),
			clone
		} as unknown as Pick<Response, 'status' | 'headers' | 'clone'>);

		expect(preview).toBeNull();
		expect(clone).not.toHaveBeenCalled();
	});

	it('includes a formatted preview for small JSON error responses', async () => {
		const bodyText = JSON.stringify({ message: 'boom' });
		const text = vi.fn(async () => bodyText);
		const clone = vi.fn(() => ({ text }));

		const preview = await getErrorResponseBodyPreview({
			status: 500,
			headers: new Headers({
				'content-type': 'application/json',
				'content-length': String(bodyText.length)
			}),
			clone
		} as unknown as Pick<Response, 'status' | 'headers' | 'clone'>);

		expect(preview).toBe('{\n  "message": "boom"\n}');
		expect(clone).toHaveBeenCalledTimes(1);
		expect(text).toHaveBeenCalledTimes(1);
	});

	it('omits previews for large or unknown-size error responses without cloning the body', async () => {
		const clone = vi.fn();

		expect(
			getErrorResponseBodyPreviewPolicy(
				500,
				'application/json',
				String(MAX_LOGGED_RESPONSE_BODY_BYTES + 1)
			)
		).toEqual({
			shouldReadBody: false,
			omissionReason: `<body omitted: content-length ${MAX_LOGGED_RESPONSE_BODY_BYTES + 1} exceeds ${MAX_LOGGED_RESPONSE_BODY_BYTES} bytes>`
		});

		const preview = await getErrorResponseBodyPreview({
			status: 500,
			headers: new Headers({
				'content-type': 'application/json'
			}),
			clone
		} as unknown as Pick<Response, 'status' | 'headers' | 'clone'>);

		expect(preview).toBe('<body omitted: content-length unavailable>');
		expect(clone).not.toHaveBeenCalled();
	});
});
