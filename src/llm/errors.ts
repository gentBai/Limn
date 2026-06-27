import { ErrorCode } from '@/shared/messages';

export function classifyHttpError(status: number): ErrorCode {
  if (status === 401 || status === 403) return ErrorCode.INVALID_API_KEY;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status >= 500) return ErrorCode.MODEL_ERROR;
  return ErrorCode.NETWORK_ERROR;
}

export function isRetryable(code: ErrorCode): boolean {
  return [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.PROVIDER_TIMEOUT,
    ErrorCode.RATE_LIMITED,
  ].includes(code);
}
