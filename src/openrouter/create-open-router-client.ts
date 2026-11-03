import { ModelError } from '../errors.js';
import { type OpenRouterOptions } from './types.js';
import { type GenerateInput, type ModelCall } from '../types.js';

function record(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function nonnegative(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  return undefined;
}

async function readResponse(response: Response, maximumBytes: number): Promise<unknown> {
  if (!response.body) throw new ModelError('provider_invalid_response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maximumBytes) throw new ModelError('provider_response_too_large');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const output = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(output));
  } catch {
    throw new ModelError('provider_invalid_response');
  }
}

export function createOpenRouterClient(options: OpenRouterOptions) {
  const { apiKey, model } = options;
  const maxInputChars = options.maxInputChars ?? 32_000;
  const maxResponseBytes = options.maxResponseBytes ?? 262_144;
  let endpoint: URL;
  try {
    endpoint = new URL(options.endpoint);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
    if (
      (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && local)) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !apiKey ||
      /[\r\n]/.test(apiKey) ||
      !model ||
      model.length > 200 ||
      model.includes(apiKey) ||
      endpoint.href.includes(apiKey) ||
      !Number.isSafeInteger(maxInputChars) ||
      maxInputChars < 1 ||
      maxInputChars > 200_000 ||
      !Number.isSafeInteger(maxResponseBytes) ||
      maxResponseBytes < 1 ||
      maxResponseBytes > 1_048_576
    ) {
      throw new ModelError('provider_configuration');
    }
  } catch {
    throw new ModelError('provider_configuration');
  }
  const request = options.fetch ?? fetch;

  return {
    provider: 'openrouter' as const,
    model,
    async generate(input: GenerateInput): Promise<{ text: string; call: ModelCall }> {
      if (input.signal.aborted) throw new ModelError('provider_aborted');
      if (
        !Number.isSafeInteger(input.maxOutputTokens) ||
        input.maxOutputTokens < 1 ||
        input.maxOutputTokens > 32_000 ||
        input.messages.length === 0 ||
        input.messages.some(
          (message) =>
            !['system', 'user', 'assistant'].includes(message.role) ||
            typeof message.content !== 'string',
        ) ||
        !record(input.responseSchema)
      ) {
        throw new ModelError('invalid_input');
      }
      let body: string;
      try {
        body = JSON.stringify({
          model,
          messages: input.messages,
          max_completion_tokens: input.maxOutputTokens,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'response', strict: true, schema: input.responseSchema },
          },
          provider: { allow_fallbacks: false, require_parameters: true },
          stream: false,
        });
      } catch {
        throw new ModelError('invalid_input');
      }
      if (body.length > maxInputChars) throw new ModelError('provider_input_too_large');
      if (body.includes(apiKey)) throw new ModelError('provider_configuration');
      const call: ModelCall = {
        id: crypto.randomUUID(),
        provider: 'openrouter',
        requestedModel: model,
        model: null,
        input: body,
        output: null,
        latencyMs: null,
        status: 'pending',
      };
      await input.recordCall(Object.freeze({ ...call }));
      if (input.signal.aborted) {
        call.status = 'failed';
        call.error = 'provider_aborted';
        await input.recordCall(Object.freeze({ ...call }));
        throw new ModelError('provider_aborted');
      }
      const started = performance.now();
      let failure: ModelError | undefined;
      try {
        const response = await request(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
          signal: input.signal,
          redirect: 'error',
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new ModelError('provider_http_error', response.status);
        }
        const data = record(await readResponse(response, maxResponseBytes));
        const choices = data?.choices;
        const first = Array.isArray(choices) ? record(choices[0]) : undefined;
        const message = record(first?.message);
        if (
          data?.error ||
          typeof data?.model !== 'string' ||
          data.model.length < 1 ||
          data.model.length > 200 ||
          data.model.includes(apiKey)
        ) {
          throw new ModelError('provider_invalid_response');
        }
        call.model = data.model;
        const usage = record(data.usage);
        const inputTokens = nonnegative(usage?.prompt_tokens);
        const outputTokens = nonnegative(usage?.completion_tokens);
        const cost = nonnegative(usage?.cost);
        if (inputTokens !== undefined && Number.isSafeInteger(inputTokens))
          call.inputTokens = inputTokens;
        if (outputTokens !== undefined && Number.isSafeInteger(outputTokens))
          call.outputTokens = outputTokens;
        if (cost !== undefined) call.costUsd = cost;
        if (typeof message?.content !== 'string' || message.content.length > 200_000) {
          throw new ModelError('provider_invalid_response');
        }
        call.output = message.content.replaceAll(apiKey, '[redacted]');
        call.status = 'completed';
      } catch (error) {
        if (input.signal.aborted) {
          failure = new ModelError('provider_aborted');
          call.status = 'unknown';
        } else if (error instanceof ModelError) {
          failure = error;
          call.status = 'failed';
        } else {
          failure = new ModelError('provider_failed');
          call.status = 'unknown';
        }
        call.error = failure.code;
      }
      call.latencyMs = performance.now() - started;
      await input.recordCall(Object.freeze({ ...call }));
      if (failure) throw failure;
      return { text: call.output!, call };
    },
  };
}
