import { Effect, Schema } from 'effect';
import { ModelError } from '../errors.js';

export const readResponse = Effect.fn('models.openrouter.readResponse')(function* (
  response: Response,
  maximumBytes: number,
  signal: AbortSignal,
) {
  if (!response.body) return yield* Effect.fail(new ModelError('provider_invalid_response'));
  const body = response.body;
  const unavailable = () => new ModelError(signal.aborted ? 'provider_aborted' : 'provider_failed');
  const text = yield* Effect.acquireUseRelease(
    Effect.sync(() => body.getReader()),
    (reader) =>
      Effect.gen(function* () {
        const decoder = new TextDecoder();
        let bytes = 0;
        let text = '';
        while (true) {
          const chunk = yield* Effect.tryPromise({ try: () => reader.read(), catch: unavailable });
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > maximumBytes)
            return yield* Effect.fail(new ModelError('provider_response_too_large'));
          text += decoder.decode(chunk.value, { stream: true });
        }
        return text + decoder.decode();
      }),
    (reader) =>
      Effect.tryPromise({ try: () => reader.cancel(), catch: unavailable }).pipe(
        Effect.onExit(() => Effect.sync(() => reader.releaseLock())),
      ),
  );
  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(text).pipe(
    Effect.mapError(() => new ModelError('provider_invalid_response')),
  );
});
