import { Schema } from 'effect';

export const CallId = Schema.String.check(Schema.isUUID());
export const Timestamp = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
);
export const ModelRoute = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/),
);
export const ModelMessage = Schema.Struct({
  role: Schema.Literals(['system', 'user', 'assistant']),
  content: Schema.String,
});
export const ModelCallInput = Schema.Struct({
  id: CallId,
  model: ModelRoute,
  messages: Schema.Array(ModelMessage),
  responseSchema: Schema.Record(Schema.String, Schema.Unknown),
  maxOutputTokens: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 32_768 })),
  deadlineAt: Timestamp,
});
export type ModelCallInput = typeof ModelCallInput.Type;

export const ModelCallRecord = Schema.Struct({
  id: CallId,
  provider: Schema.Literal('openrouter'),
  requestedModel: ModelRoute,
  model: Schema.NullOr(Schema.String),
  input: Schema.String,
  output: Schema.NullOr(Schema.String),
  latencyMs: Schema.NullOr(Schema.Number),
  status: Schema.Literals(['pending', 'completed', 'failed', 'unknown']),
  inputTokens: Schema.optional(Schema.Number),
  outputTokens: Schema.optional(Schema.Number),
  costUsd: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
});
export type ModelCallRecord = typeof ModelCallRecord.Type;

export const ModelCallResponse = Schema.Struct({ call: ModelCallRecord });
export type ModelCallResponse = typeof ModelCallResponse.Type;

export const ModelErrorCode = Schema.Literals([
  'invalid_bearer',
  'invalid_call',
  'invalid_call_deadline',
  'call_conflict',
  'grant_busy',
  'grant_uncertain',
  'model_not_allowed',
  'call_limit_exceeded',
  'call_budget_exceeded',
  'call_not_found',
  'not_found',
  'models_unavailable',
]);
export type ModelErrorCode = typeof ModelErrorCode.Type;

export const ModelErrorResponse = Schema.Struct({ error: ModelErrorCode });
export type ModelErrorResponse = typeof ModelErrorResponse.Type;
