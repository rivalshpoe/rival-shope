import { isServer, QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/api/errors";

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof AppError)) return false;
  if (error.method !== null && error.method !== "GET") return false;
  if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") return true;
  return error.status !== null && error.status >= 500 && error.status !== 501;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Prevents an immediate client refetch after server-side hydration.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 3_000),
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server: always a fresh client per request (no cross-request cache sharing).
 * Browser: a singleton that survives React suspending during the initial render.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
