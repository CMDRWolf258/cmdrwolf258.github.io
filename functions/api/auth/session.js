import {
  accessLabel,
  canReviewMining,
  canSubmitMining,
  json,
  readSession,
} from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env);

  if (!session) {
    return json({
      authenticated: false,
      access: 'public',
      accessLabel: 'Public',
      canSubmitMining: false,
      canReviewMining: false,
    });
  }

  return json({
    authenticated: true,
    userId: session.sub,
    username: session.username,
    displayName: session.displayName,
    access: session.access,
    accessLabel: accessLabel(session.access),
    membershipVerified: session.membershipVerified,
    canSubmitMining: canSubmitMining(session),
    canReviewMining: canReviewMining(session),
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}
