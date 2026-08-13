type ApiProfilerLogger = Pick<Console, 'log' | 'error'>;

interface ProfileApiQueryOptions {
	method?: string;
	logger?: ApiProfilerLogger;
	shouldLogError?: (error: unknown) => boolean;
}

function formatDuration(durationMs: number): string {
	return `${durationMs.toFixed(1)}ms`;
}

export async function profileApiQuery<T>(
	url: string,
	run: () => Promise<T>,
	options: ProfileApiQueryOptions = {}
): Promise<T> {
	const { method = 'GET', logger = console, shouldLogError = () => true } = options;
	const startedAt = performance.now();

	try {
		const result = await run();
		logger.log(
			`[api] ${method} ${url} completed in ${formatDuration(performance.now() - startedAt)}`
		);
		return result;
	} catch (error) {
		if (shouldLogError(error)) {
			logger.error(
				`[api] ${method} ${url} failed in ${formatDuration(performance.now() - startedAt)}`,
				error
			);
		}

		throw error;
	}
}
