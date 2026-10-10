import { isAxiosError } from 'axios';

/** Pull the backend's `{ error }` message out of a failed request, or fall back. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError<{ error?: string }>(err)) return err.response?.data?.error || fallback;
  return fallback;
}

export function apiErrorStatus(err: unknown): number | undefined {
  return isAxiosError(err) ? err.response?.status : undefined;
}
