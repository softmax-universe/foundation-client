import { Data } from 'effect';
import type { ModelErrorCode } from './types.js';

export class ModelError extends Data.TaggedError('ModelError')<{
  code: ModelErrorCode;
  status?: number;
}> {
  constructor(code: ModelErrorCode, status?: number) {
    super({ code, ...(status === undefined ? {} : { status }) });
  }
}
