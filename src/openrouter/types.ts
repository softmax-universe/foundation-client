import type { Redacted } from 'effect';

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  endpoint: string;
  maxInputChars?: number;
  maxResponseBytes?: number;
  fetch?: typeof fetch;
}

export interface ProviderConfiguration {
  apiKey: Redacted.Redacted<string>;
  model: string;
  endpoint: URL;
  maxInputChars: number;
  maxResponseBytes: number;
  fetch: typeof fetch;
}
