export interface ModelCall {
  id: string;
  provider: string;
  requestedModel: string;
  model: string | null;
  input: string;
  output: string | null;
  latencyMs: number | null;
  status: 'pending' | 'completed' | 'failed' | 'unknown';
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  error?: string;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateInput {
  messages: readonly ModelMessage[];
  responseSchema: Record<string, unknown>;
  maxOutputTokens: number;
  signal: AbortSignal;
  recordCall(call: ModelCall): Promise<void>;
}

export type ModelErrorCode =
  | 'invalid_input'
  | 'provider_aborted'
  | 'provider_configuration'
  | 'provider_failed'
  | 'provider_http_error'
  | 'provider_input_too_large'
  | 'provider_invalid_response'
  | 'provider_response_too_large';
