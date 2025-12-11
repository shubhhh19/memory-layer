'use client';

import { useEffect } from 'react';
import { Icon } from '@iconify/react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="max-w-md w-full text-center">
        <Icon
          icon="material-symbols:error-outline"
          className="w-16 h-16 mx-auto mb-4 text-red-500"
        />
        <h2 className="text-2xl font-bold mb-2 text-[var(--text)]">Something went wrong</h2>
        <p className="text-[var(--muted-text)] mb-6">
          {error?.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

