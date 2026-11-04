import { Effect } from 'effect';
import type { GenerateInput } from '../types.js';
import { generate } from './generate.js';
import { readConfiguration } from './read-configuration.js';
import type { OpenRouterOptions } from './types.js';

export function createOpenRouterClient(options: OpenRouterOptions) {
  const configuration = Effect.runSync(readConfiguration(options));
  return {
    provider: 'openrouter' as const,
    model: configuration.model,
    generate(input: GenerateInput) {
      return Effect.runPromise(
        generate(configuration, input).pipe(
          Effect.catchTag('EvidenceWriteFailed', (failure) => Effect.fail(failure.cause)),
        ),
      );
    },
  };
}
