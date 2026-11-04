import { Schema } from 'effect';
import { CallId, ModelCallInput } from './models-protocol/index.js';
import { callWaitMs, readWaitMs } from './constants.js';
import { FoundationError } from './errors.js';
import { requestCall } from './request-call.js';
import { waitForPoll } from './wait-for-poll.js';
import type { FoundationClient, FoundationClientOptions } from './types.js';

export function createFoundationClient(options: FoundationClientOptions): FoundationClient {
  let origin: URL;
  try {
    origin = new URL(options.endpoint);
  } catch {
    throw new TypeError('Foundation endpoint must be an explicit HTTP origin');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && local)) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new TypeError('Foundation endpoint must be an HTTPS origin or local HTTP origin');
  }
  if (!options.token || options.token.trim() !== options.token || /[\r\n]/.test(options.token)) {
    throw new TypeError('Foundation token must be a nonempty bearer credential');
  }
  const connection = {
    endpoint: origin.origin,
    token: options.token,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
  };
  return {
    models: {
      async call(input, request = {}) {
        const callId = readCallId(input.id);
        let decoded: ModelCallInput;
        try {
          decoded = Schema.decodeUnknownSync(ModelCallInput)(input);
        } catch {
          throw new FoundationError({ code: 'invalid_call', callId, outcome: 'not_started' });
        }
        const duration = Math.min(callWaitMs, Date.parse(decoded.deadlineAt) - Date.now());
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new FoundationError({ code: 'deadline_exceeded', callId, outcome: 'not_started' });
        }
        if (request.signal?.aborted) {
          throw new FoundationError({ code: 'cancelled', callId, outcome: 'not_started' });
        }
        const deadline = AbortSignal.timeout(Math.ceil(duration));
        const signal = request.signal ? AbortSignal.any([request.signal, deadline]) : deadline;
        let call = await requestCall({ ...connection, callId, input: decoded, signal });
        while (call.status === 'pending') {
          try {
            await waitForPoll(signal);
          } catch {
            throw new FoundationError({
              code: deadline.aborted ? 'deadline_exceeded' : 'cancelled',
              callId,
              outcome: 'unknown',
            });
          }
          call = await requestCall({ ...connection, callId, signal });
        }
        return call;
      },
      getCall(id, request = {}) {
        const callId = readCallId(id);
        const deadline = AbortSignal.timeout(readWaitMs);
        const signal = request.signal ? AbortSignal.any([request.signal, deadline]) : deadline;
        return requestCall({ ...connection, callId, signal });
      },
    },
  };
}

function readCallId(id: string): string {
  try {
    return Schema.decodeUnknownSync(CallId)(id);
  } catch {
    throw new TypeError('Foundation call ID must be a UUID');
  }
}
