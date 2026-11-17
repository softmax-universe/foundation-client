import { IdentityClient, IdentitySessionError } from '@softmax-universe/identity-client';

const clientId = document.querySelector('meta[name="softmax-client-id"]').content;
const identity = new IdentityClient(clientId, location.origin);
const status = document.querySelector('[role="status"]');
const signIn = document.querySelector('#sign-in');
const signOut = document.querySelector('#sign-out');

function showSignedOut(message = 'Signed out.') {
  status.textContent = message;
  signIn.hidden = false;
  signOut.hidden = true;
}

async function showViewer() {
  const response = await identity.fetch('/api/viewer');
  if (!response.ok) throw new Error('Account lookup failed');
  const viewer = await response.json();
  status.textContent = `Signed in as ${viewer.subject}`;
  signIn.hidden = true;
  signOut.hidden = false;
}

signIn.addEventListener('click', async () => {
  signIn.disabled = true;
  try {
    location.assign(await identity.authorizationUrl('/'));
  } catch {
    showSignedOut('Could not open Softmax sign-in. Try again.');
  } finally {
    signIn.disabled = false;
  }
});

signOut.addEventListener('click', async () => {
  signOut.disabled = true;
  try {
    const result = await identity.signOut();
    if (result.kind === 'session-changed') {
      showSignedOut('Your session changed in another tab. Sign in again.');
    } else {
      const message =
        result.revocation === 'complete'
          ? 'Signed out.'
          : 'Signed out here. Identity could not confirm revocation.';
      showSignedOut(message);
    }
  } catch {
    status.textContent = 'Could not confirm sign-out. Try again.';
  } finally {
    signOut.disabled = false;
  }
});

try {
  let session;
  if (new URL(location.href).searchParams.has('identity_complete')) {
    const result = await identity.completeAuthorization(location.href);
    history.replaceState(history.state, '', result.returnTo);
    session = result.session;
  } else {
    session = await identity.restore();
  }
  if (session) await showViewer();
  else showSignedOut();
} catch (error) {
  const ended = error instanceof IdentitySessionError && error.code === 'unauthorized';
  showSignedOut(
    ended ? 'Your session ended. Sign in again.' : 'Sign-in is unavailable. Reload to retry.',
  );
}
