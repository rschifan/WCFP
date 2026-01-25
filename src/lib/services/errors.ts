/**
 * Service Error Types
 *
 * Simple, typed error handling for service layer.
 * Services throw ServiceError with specific codes; callers handle based on code.
 */

/**
 * Error codes for different error scenarios
 */
export enum ServiceErrorCode {
	/** Expected: no data file exists for this region */
	DATA_NOT_FOUND = 'DATA_NOT_FOUND',
	/** Network/connection errors */
	NETWORK_ERROR = 'NETWORK_ERROR',
	/** Invalid data format/parsing errors */
	INVALID_DATA = 'INVALID_DATA',
	/** Validation errors (invalid input) */
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	/** Aborted requests */
	ABORTED = 'ABORTED',
	/** Unknown/unexpected errors */
	UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Service error with typed code and optional context.
 *
 * Usage:
 * - Services throw ServiceError with appropriate code
 * - Callers check `err.code` or use `isExpected()` / `isRecoverable()` helpers
 * - Expected errors (DATA_NOT_FOUND) are handled gracefully, unexpected errors bubble up
 */
export class ServiceError extends Error {
	readonly code: ServiceErrorCode;
	readonly context?: Record<string, unknown>;

	constructor(code: ServiceErrorCode, message: string, context?: Record<string, unknown>) {
		super(message);
		this.name = 'ServiceError';
		this.code = code;
		this.context = context;

		// Maintains proper stack trace (V8 only)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ServiceError);
		}
	}

	/**
	 * Check if error is expected (data not found) vs unexpected (network, parsing, etc.)
	 */
	isExpected(): boolean {
		return this.code === ServiceErrorCode.DATA_NOT_FOUND;
	}

	/**
	 * Check if error is recoverable (can continue processing other items)
	 */
	isRecoverable(): boolean {
		return this.code === ServiceErrorCode.DATA_NOT_FOUND || this.code === ServiceErrorCode.ABORTED;
	}
}
