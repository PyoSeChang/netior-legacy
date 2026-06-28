import { DomainNotFoundError, DomainValidationError } from '@netior/core';

export class JsonRpcProtocolError extends Error {
  constructor(readonly code: number, message: string, readonly data?: unknown) {
    super(message);
    this.name = 'JsonRpcProtocolError';
  }
}

export function jsonRpcErrorCode(error: unknown): number {
  if (error instanceof JsonRpcProtocolError) return error.code;
  if (error instanceof DomainNotFoundError) return -32004;
  if (error instanceof DomainValidationError) return -32002;
  return -32000;
}

export function jsonRpcErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
