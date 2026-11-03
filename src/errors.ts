import { type ModelErrorCode } from './types.js';

export class ModelError extends Error {
  constructor(
    readonly code: ModelErrorCode,
    readonly status?: number,
  ) {
    super(code);
    this.name = 'ModelError';
  }
}
