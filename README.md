# Foundation Models

`@softmax-foundation/models` makes one bounded OpenRouter call and records provider evidence. It runs in Node and
Workers without Identity, game types, or private packages. The caller owns credentials, deadlines, budgets and any
retry decision.

Install the checked public archive without a private registry credential:

```sh
pnpm add https://github.com/Metta-AI/foundation-models/releases/download/models-v0.1.1/softmax-foundation-models-0.1.1.tgz
```

```ts
import { createOpenRouterClient } from '@softmax-foundation/models';

const client = createOpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY!,
  model: 'provider/model',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
});
const result = await client.generate({
  messages: [{ role: 'user', content: 'Choose an action.' }],
  responseSchema: {
    type: 'object',
    properties: { action: { type: 'string' } },
    required: ['action'],
    additionalProperties: false,
  },
  maxOutputTokens: 256,
  signal: AbortSignal.timeout(30_000),
  recordCall: async (call) => {
    await saveCall(call);
  },
});
```

`recordCall` receives an immutable snapshot with a stable call ID before dispatch and after the result changes.
Persist the initial `pending` snapshot before returning from the callback. A callback failure prevents dispatch or
surfaces a failure to save the result. An interrupted request becomes `unknown`; it is never retried automatically.
`requestedModel` is the configured route; `model` is the provider-reported model, or `null` when unavailable.
Usage and cost are included only when present in the completion response. There are no follow-up usage requests.

`responseSchema` is sent to the provider; the caller validates the returned text against its domain. Credentials
are excluded from evidence, redirects are rejected, input and response sizes are bounded, and `ModelError` exposes
a safe code and optional HTTP status. Each call has exactly one HTTP attempt and disables provider fallbacks.
