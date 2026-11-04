import { Effect, Redacted } from 'effect';
import { ModelError } from '../errors.js';
import { readResponse } from './read-response.js';
import type { ProviderConfiguration } from './types.js';

export const requestCompletion = Effect.fn('models.openrouter.request')(function* (
  configuration: ProviderConfiguration,
  body: string,
  signal: AbortSignal,
) {
  const unavailable = () => new ModelError(signal.aborted ? 'provider_aborted' : 'provider_failed');
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => new AbortController()),
    (controller) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            configuration.fetch(configuration.endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${Redacted.value(configuration.apiKey)}`,
                'Content-Type': 'application/json',
              },
              body,
              signal: AbortSignal.any([signal, controller.signal]),
              redirect: 'error',
            }),
          catch: unavailable,
        });
        if (!response.ok) {
          yield* Effect.tryPromise({
            try: () => response.body?.cancel() ?? Promise.resolve(),
            catch: unavailable,
          });
          return yield* Effect.fail(new ModelError('provider_http_error', response.status));
        }
        return yield* readResponse(response, configuration.maxResponseBytes, signal);
      }),
    (controller) => Effect.sync(() => controller.abort()),
  );
});
