import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileApiQuery } from './api-profiler';

describe('profileApiQuery', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('logs the elapsed time on success without the parsed result payload', async () => {
		const log = vi.fn();
		vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(142.75);

		const result = await profileApiQuery('/api/v1/species/42', async () => ({ ok: true, id: 42 }), {
			logger: { log, error: vi.fn() }
		});

		expect(result).toEqual({ ok: true, id: 42 });
		expect(log).toHaveBeenCalledWith('[api] GET /api/v1/species/42 completed in 42.8ms');
	});

	it('logs failures unless the caller suppresses them', async () => {
		const error = new Error('boom');
		const logger = { log: vi.fn(), error: vi.fn() };
		vi.spyOn(performance, 'now').mockReturnValueOnce(10).mockReturnValueOnce(35.4);

		await expect(
			profileApiQuery('/api/v1/fail', async () => Promise.reject(error), { logger })
		).rejects.toThrow('boom');
		expect(logger.error).toHaveBeenCalledWith('[api] GET /api/v1/fail failed in 25.4ms', error);
	});

	it('can skip error logging for expected failures', async () => {
		const logger = { log: vi.fn(), error: vi.fn() };
		vi.spyOn(performance, 'now').mockReturnValueOnce(50).mockReturnValueOnce(80);

		await expect(
			profileApiQuery(
				'/api/v1/skipped',
				async () => {
					throw new Error('skip me');
				},
				{
					logger,
					shouldLogError: () => false
				}
			)
		).rejects.toThrow('skip me');

		expect(logger.error).not.toHaveBeenCalled();
	});
});
