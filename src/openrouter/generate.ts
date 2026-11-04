import { Clock, Effect, Redacted, Result, Schema } from 'effect';
import { ModelError } from '../errors.js';
import type { GenerateInput, ModelCall } from '../types.js';
import { EvidenceWriteFailed } from './errors.js';
import { prepareRequest } from './prepare-request.js';
import { requestCompletion } from './request-completion.js';
import { Choices, Envelope } from './schemas.js';
import type { ProviderConfiguration } from './types.js';

export const generate = Effect.fn('models.openrouter.generate')(function* (
  configuration: ProviderConfiguration,
  input: GenerateInput,
) {
  const body = yield* prepareRequest(configuration, input);
  const record = (call: ModelCall) =>
    Effect.tryPromise({
      try: () => input.recordCall(Object.freeze({ ...call })),
      catch: (cause) => new EvidenceWriteFailed({ cause }),
    });
  let call: ModelCall = {
    id: crypto.randomUUID(),
    provider: 'openrouter',
    requestedModel: configuration.model,
    model: null,
    input: body,
    output: null,
    latencyMs: null,
    status: 'pending',
  };
  yield* record(call);
  if (input.signal.aborted) {
    yield* record({ ...call, status: 'failed', error: 'provider_aborted' });
    return yield* Effect.fail(new ModelError('provider_aborted'));
  }
  const started = yield* Clock.currentTimeMillis;
  const result = yield* Effect.result(
    Effect.gen(function* () {
      const value = yield* requestCompletion(configuration, body, input.signal);
      const envelope = yield* Schema.decodeUnknownEffect(Envelope, { onExcessProperty: 'error' })(
        value,
      ).pipe(Effect.mapError(() => new ModelError('provider_invalid_response')));
      const secret = Redacted.value(configuration.apiKey);
      if (envelope.model.includes(secret))
        return yield* Effect.fail(new ModelError('provider_invalid_response'));
      call.model = envelope.model;
      if (envelope.usage?.prompt_tokens != null) call.inputTokens = envelope.usage.prompt_tokens;
      if (envelope.usage?.completion_tokens != null)
        call.outputTokens = envelope.usage.completion_tokens;
      if (envelope.usage?.cost != null) call.costUsd = envelope.usage.cost;
      const choices = yield* Schema.decodeUnknownEffect(Choices, { onExcessProperty: 'error' })(
        envelope.choices,
      ).pipe(Effect.mapError(() => new ModelError('provider_invalid_response')));
      const first = choices[0];
      if (!first) return yield* Effect.fail(new ModelError('provider_invalid_response'));
      return first.message.content.replaceAll(secret, '[redacted]');
    }),
  );
  call.latencyMs = (yield* Clock.currentTimeMillis) - started;
  if (Result.isFailure(result)) {
    call = {
      ...call,
      status: ['provider_aborted', 'provider_failed'].includes(result.failure.code)
        ? 'unknown'
        : 'failed',
      error: result.failure.code,
    };
    yield* record(call);
    return yield* Effect.fail(result.failure);
  }
  call = { ...call, output: result.success, status: 'completed' };
  yield* record(call);
  return { text: result.success, call };
});
