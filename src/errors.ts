import type { FoundationFailure } from './types.js';

export class FoundationError extends Error implements FoundationFailure {
  readonly code;
  readonly callId;
  readonly outcome;
  readonly status;

  constructor(failure: FoundationFailure) {
    super(`Foundation request failed: ${failure.code}`);
    this.name = 'FoundationError';
    this.code = failure.code;
    this.callId = failure.callId;
    this.outcome = failure.outcome;
    this.status = failure.status;
  }
}
