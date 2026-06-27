import { describe, it, expect } from 'vitest';
import { classifyHttpError } from '@/llm/errors';
import { ErrorCode } from '@/shared/messages';

describe('classifyHttpError', () => {
  it('maps 401 to INVALID_API_KEY', () => {
    expect(classifyHttpError(401)).toBe(ErrorCode.INVALID_API_KEY);
  });
  it('maps 429 to RATE_LIMITED', () => {
    expect(classifyHttpError(429)).toBe(ErrorCode.RATE_LIMITED);
  });
  it('maps 5xx to MODEL_ERROR', () => {
    expect(classifyHttpError(500)).toBe(ErrorCode.MODEL_ERROR);
  });
  it('maps 0 (network) to NETWORK_ERROR', () => {
    expect(classifyHttpError(0)).toBe(ErrorCode.NETWORK_ERROR);
  });
});
