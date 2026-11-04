import type {
  ModelCallInput,
  ModelCallRecord,
  ModelErrorCode,
} from './models-protocol/index.js';

export interface FoundationClientOptions {
  endpoint: string;
  token: string;
  fetch?: typeof globalThis.fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface FoundationClient {
  models: {
    call(input: ModelCallInput, options?: RequestOptions): Promise<ModelCallRecord>;
    getCall(id: string, options?: RequestOptions): Promise<ModelCallRecord>;
  };
}

export type FoundationErrorCode =
  | ModelErrorCode
  | 'cancelled'
  | 'deadline_exceeded'
  | 'transport_unavailable'
  | 'invalid_response'
  | 'response_too_large';

export interface FoundationFailure {
  code: FoundationErrorCode;
  callId: string;
  outcome: 'not_started' | 'unknown';
  status?: number;
}

export interface CallRequest {
  endpoint: string;
  token: string;
  fetch: typeof globalThis.fetch;
  callId: string;
  input?: ModelCallInput;
  signal: AbortSignal;
}
