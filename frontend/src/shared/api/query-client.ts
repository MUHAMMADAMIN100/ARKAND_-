import { QueryClient } from '@tanstack/react-query';
import { HttpError } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Не ретраим клиентские ошибки (4xx) — только сетевые/5xx, до 2 раз.
        if (error instanceof HttpError && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
