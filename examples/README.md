# Sign in with Softmax

Create a registration at [Softmax Developers](https://developers.softmax.com/apps). Each example uses
the type and client ID from that registration. Users approve access in the browser and return to your
application automatically.

Choose an [Identity SDK release](https://github.com/softmax-universe/foundation-client/releases?q=identity-client).
Use the examples from that release's tag and install its matching archive with `pnpm add <archive-url>`.
The examples require Node 24 or later.

## Website with a backend

Create a website registration for `http://localhost:3000` with callback
`http://localhost:3000/api/auth/callback`. Issue a client secret in the portal. Configure it through
your server's secret settings, or put it in an owner-only `.env` file for local development.

```dotenv
SOFTMAX_CLIENT_ID=your-registered-client-id
SOFTMAX_CLIENT_SECRET=your-issued-client-secret
SOFTMAX_APP_ORIGIN=http://localhost:3000
```

Keep the secret on the server. Exclude `.env` from Git. Build the browser module and start the server.

```sh
pnpm add -D esbuild@0.28.2
pnpm exec esbuild website-browser.mjs --bundle --format=esm --outfile=website-browser.js
node --env-file=.env website.mjs
```

Open `http://localhost:3000` and select **Sign in with Softmax**. The example completes the callback,
uses the server session to read the viewer and restores the session when you reload. The SDK renews
the session when it approaches expiry. **Sign out** clears the application's session and attempts to revoke
its refresh credential.

Host a production site behind HTTPS and configure `SOFTMAX_APP_ORIGIN` and the callback to match the
registered origin exactly. Use the Identity subject as the stable link to your application's account.
Your application decides what an authenticated account can do.

## Local application or agent

Create a local application registration and use its client ID. The SDK opens the browser on first setup and
receives approval on the same machine through `http://127.0.0.1/auth/callback` on an available port.
Only the public client ID needs configuring.

```sh
export SOFTMAX_CLIENT_ID=your-registered-client-id
node local-application.mjs sign-in
node local-application.mjs run
node local-application.mjs sign-out
```

The second command runs in a separate process. `getAccessToken()` loads and renews the saved session
without reopening the browser. It produces an Identity-only credential for this example. An approved
resource audience and scopes are required to call a product API.

## Other application frameworks

Use the issuer `https://identity.softmax.com` and its
[OpenID Connect discovery document](https://identity.softmax.com/.well-known/openid-configuration).
Use authorization code flow with S256 PKCE and the exact registered callback. A website backend
authenticates at the token endpoint with `client_secret_basic`. A local application uses the public
client ID and PKCE. Validate state, nonce and the ID token using a maintained OpenID Connect library.
Select the stable `sub` claim for account linking. Email may be absent.
