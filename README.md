# Foundation client

`@softmax-foundation/client` connects applications to the Foundation gateway. The current API executes model calls
under a revocable Foundation grant. Nexus issues that grant after approval; provider credentials stay on the server.

Install the immutable archive from the [public releases](https://github.com/softmax-universe/foundation-client/releases).

```ts
import { createFoundationClient, FoundationError } from '@softmax-foundation/client';

const foundation = createFoundationClient({ endpoint, token });
const input = {
  id: crypto.randomUUID(),
  model: 'openai/gpt-4.1-mini',
  messages: [{ role: 'user' as const, content: 'Choose one legal move.' }],
  responseSchema: { type: 'object', properties: { move: { type: 'integer' } }, required: ['move'] },
  maxOutputTokens: 64,
  deadlineAt: new Date(Date.now() + 25_000).toISOString(),
};

// Persist the request and its ID before starting paid work.
await persistIntent(input);
try {
  const call = await foundation.models.call(input, { signal });
  await persistEvidence(call);
} catch (error) {
  if (!(error instanceof FoundationError)) throw error;
  await persistFailure({ id: error.callId, code: error.code, outcome: error.outcome });
}

const evidence = await foundation.models.getCall(input.id);
```

Supply an explicit HTTPS origin and a Foundation bearer grant. Local HTTP is accepted only for loopback development.
The client sends no cookies, refuses redirects, and accepts a `fetch` implementation for an actual transport boundary.
Keep grants server-side unless the browser itself is the intended grant holder.

`models.call` submits the caller's UUID exactly once, then polls pending evidence with GET. It waits until the supplied
deadline or 30 seconds, whichever comes first. It returns terminal `completed`, `failed`, or `unknown` evidence.
`models.getCall` performs one GET, bounded to 10 seconds, and can return `pending`. Both accept an `AbortSignal`.
Cancellation stops the client's wait; it does not undo an accepted server call.

`FoundationError` contains a fixed `code`, `callId`, `outcome`, and optional HTTP `status`. It omits response bodies,
credentials, and transport causes. `not_started` identifies local validation/cancellation before submission or a known
admission rejection for this submission. It does not erase earlier evidence if an application reuses a UUID.
`unknown` means the call may have started: keep its ID and budget reservation, then reconcile
with `getCall`. Never substitute a new ID after an uncertain result. The SDK never retries a POST or provider call.

The archive bundles the public Models schemas and their declarations. Its only runtime dependency is public Effect.
It exposes no grant administration, private RPC, database, or provider transport. To build the exported source, run
`npm install`, then `npm run build`; the complete package appears in `release/`.
