export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  endpoint: string;
  maxInputChars?: number;
  maxResponseBytes?: number;
  fetch?: typeof fetch;
}
