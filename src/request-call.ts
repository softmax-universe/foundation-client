import { Effect, Schema } from 'effect';
import { ModelCallResponse, ModelErrorResponse } from './models-protocol/index.js';
import { FoundationError } from './errors.js';
import { readResponse } from './read-response.js';
import type { CallRequest } from './types.js';

export async function requestCall(request: CallRequest) {
  const { callId, signal } = request;
  const method = request.input ? 'POST' : 'GET';
  const path = '/api/v1/models/calls' + (method === 'GET' ? `/${callId}` : '');
  try {
    const response = await Effect.runPromise(
      Effect.tryPromise({
        try: async () => {
          const response = await request.fetch(`${request.endpoint}${path}`, {
            method,
            headers: {
              authorization: `Bearer ${request.token}`,
              'content-type': 'application/json',
            },
            body: request.input ? JSON.stringify(request.input) : undefined,
            credentials: 'omit',
            redirect: 'error',
            signal,
          });
          if (signal.aborted) void response.body?.cancel().catch(() => {});
          return response;
        },
        catch: () =>
          new FoundationError({ code: 'transport_unavailable', callId, outcome: 'unknown' }),
      }),
      { signal },
    );
    const body = await readResponse(response, callId, signal);
    if (!response.ok) {
      const failure = Schema.decodeUnknownSync(ModelErrorResponse)(body);
      throw new FoundationError({
        code: failure.error,
        callId,
        outcome:
          method === 'POST' &&
          response.status >= 400 &&
          response.status < 500 &&
          failure.error !== 'call_conflict' &&
          failure.error !== 'models_unavailable'
            ? 'not_started'
            : 'unknown',
        status: response.status,
      });
    }
    const { call } = Schema.decodeUnknownSync(ModelCallResponse)(body);
    if (
      call.id !== callId ||
      (call.status === 'pending' ? response.status !== 202 : response.status !== 200)
    ) {
      throw new FoundationError({ code: 'invalid_response', callId, outcome: 'unknown' });
    }
    return call;
  } catch (error) {
    if (signal.aborted) {
      throw new FoundationError({
        code: signal.reason?.name === 'TimeoutError' ? 'deadline_exceeded' : 'cancelled',
        callId,
        outcome: 'unknown',
      });
    }
    if (error instanceof FoundationError) throw error;
    throw new FoundationError({ code: 'invalid_response', callId, outcome: 'unknown' });
  }
}
