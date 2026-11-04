import { Effect, Redacted, Schema } from 'effect';
import { ModelError } from '../errors.js';
import { Generation } from './schemas.js';
import type { GenerateInput } from '../types.js';
import type { ProviderConfiguration } from './types.js';

export const prepareRequest = Effect.fn('models.openrouter.prepare')(function* (
  configuration: ProviderConfiguration,
  input: GenerateInput,
) {
  if (input.signal.aborted) return yield* Effect.fail(new ModelError('provider_aborted'));
  const value = yield* Schema.decodeUnknownEffect(Generation, { onExcessProperty: 'error' })({
    messages: input.messages,
    responseSchema: input.responseSchema,
    maxOutputTokens: input.maxOutputTokens,
  }).pipe(Effect.mapError(() => new ModelError('invalid_input')));
  const body = yield* Effect.try({
    try: () =>
      JSON.stringify({
        model: configuration.model,
        messages: value.messages,
        max_completion_tokens: value.maxOutputTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'response', strict: true, schema: value.responseSchema },
        },
        provider: { allow_fallbacks: false, require_parameters: true },
        stream: false,
      }),
    catch: () => new ModelError('invalid_input'),
  });
  if (body.length > configuration.maxInputChars)
    return yield* Effect.fail(new ModelError('provider_input_too_large'));
  if (body.includes(Redacted.value(configuration.apiKey)))
    return yield* Effect.fail(new ModelError('provider_configuration'));
  return body;
});
