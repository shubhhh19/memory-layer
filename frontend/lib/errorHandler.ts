/**
 * API Error Handler Utility
 * Provides consistent error handling across the frontend
 */

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export class ApiErrorHandler {
  /**
   * Parse error from API response
   */
  static parseError(error: unknown): ApiError {
    // Handle fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      };
    }

    // Handle Response objects
    if (error instanceof Response) {
      return {
        message: `Request failed with status ${error.status}`,
        status: error.status,
        code: 'HTTP_ERROR',
      };
    }

    // Handle Error objects
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR',
      };
    }

    // Handle plain objects with message
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return {
        message: String(error.message),
        status: 'status' in error ? Number(error.status) : undefined,
        code: 'code' in error ? String(error.code) : undefined,
        details: error,
      };
    }

    // Fallback
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      details: error,
    };
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: unknown): string {
    const parsed = this.parseError(error);

    // Map common status codes to user-friendly messages
    if (parsed.status) {
      switch (parsed.status) {
        case 400:
          return 'Invalid request. Please check your input.';
        case 401:
          return 'You are not authenticated. Please log in.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Server error. Please try again later.';
        case 503:
          return 'Service temporarily unavailable. Please try again later.';
      }
    }

    return parsed.message;
  }

  /**
   * Log error for debugging
   */
  static logError(error: unknown, context?: string): void {
    const parsed = this.parseError(error);
    console.error(`[API Error${context ? ` - ${context}` : ''}]:`, {
      message: parsed.message,
      status: parsed.status,
      code: parsed.code,
      details: parsed.details,
    });
  }

  /**
   * Check if error is a specific type
   */
  static isNetworkError(error: unknown): boolean {
    const parsed = this.parseError(error);
    return parsed.code === 'NETWORK_ERROR';
  }

  static isAuthError(error: unknown): boolean {
    const parsed = this.parseError(error);
    return parsed.status === 401 || parsed.status === 403;
  }

  static isRateLimitError(error: unknown): boolean {
    const parsed = this.parseError(error);
    return parsed.status === 429;
  }
}

/**
 * Retry utility for failed requests
 */
export async function retryRequest<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, shouldRetry } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
}
