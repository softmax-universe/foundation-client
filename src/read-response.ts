import { FoundationError } from './errors.js';
import { responseByteLimit } from './constants.js';

export async function readResponse(
  response: Response,
  callId: string,
  signal: AbortSignal,
): Promise<unknown> {
  if (!response.body)
    throw new FoundationError({ code: 'invalid_response', callId, outcome: 'unknown' });
  const reader = response.body.getReader();
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener('abort', onAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > responseByteLimit) {
        throw new FoundationError({ code: 'response_too_large', callId, outcome: 'unknown' });
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally {
    signal.removeEventListener('abort', onAbort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
