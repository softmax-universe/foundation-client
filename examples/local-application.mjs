import { IdentitySession } from '@softmax-universe/identity-client/session';

const clientId = process.env.SOFTMAX_CLIENT_ID;
if (!clientId) throw new Error('Set SOFTMAX_CLIENT_ID to the local application client ID.');

const identity = new IdentitySession({ profile: clientId });
switch (process.argv[2] ?? 'run') {
  case 'sign-in': {
    const session = await identity.signIn({ clientId, issuer: process.env.SOFTMAX_ISSUER });
    console.log(`Signed in as ${session.subject}.`);
    break;
  }
  case 'run': {
    await identity.getAccessToken();
    const session = await identity.getStatus();
    if (!session) throw new Error('Your session ended. Sign in again.');
    console.log(`Running as ${session.subject}.`);
    break;
  }
  case 'sign-out': {
    const result = await identity.signOut();
    console.log(
      result.revocation === 'complete'
        ? 'Signed out.'
        : 'Signed out locally. Identity could not confirm revocation.',
    );
    break;
  }
  default:
    throw new Error('Use sign-in, run, or sign-out.');
}
