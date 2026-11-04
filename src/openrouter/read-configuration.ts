import { Effect, Redacted, Schema } from 'effect';
import { ModelError } from '../errors.js';
import { Configuration } from './schemas.js';
import type { OpenRouterOptions } from './types.js';

export const readConfiguration = Effect.fn('models.openrouter.configuration')(function* (
  options: OpenRouterOptions,
) {
  const configuration = yield* Schema.decodeUnknownEffect(Configuration, {
    onExcessProperty: 'error',
  })({
    apiKey: options.apiKey,
    model: options.model,
    endpoint: options.endpoint,
    maxInputChars: options.maxInputChars ?? 32_000,
    maxResponseBytes: options.maxResponseBytes ?? 262_144,
  }).pipe(Effect.mapError(() => new ModelError('provider_configuration')));
  const endpoint = yield* Effect.try({
    try: () => new URL(configuration.endpoint),
    catch: () => new ModelError('provider_configuration'),
  });
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if (
    (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && local)) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    /[\r\n]/.test(configuration.apiKey) ||
    configuration.model.includes(configuration.apiKey) ||
    endpoint.href.includes(configuration.apiKey)
  ) {
    return yield* Effect.fail(new ModelError('provider_configuration'));
  }
  return {
    ...configuration,
    endpoint,
    apiKey: Redacted.make(configuration.apiKey),
    fetch: options.fetch ?? fetch,
  };
});
