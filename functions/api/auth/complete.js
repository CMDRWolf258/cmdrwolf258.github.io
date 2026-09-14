import { readSession, safeReturnPath } from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return'));
  const requestedResult = url.searchParams.get('result') || 'success';
  const session = await readSession(request, env);

  if (!session) {
    const retry = new URL(returnTo, url.origin);
    retry.searchParams.set('login', 'session_error');
    const headers = new Headers({ Location: retry.toString() });
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return new Response(null, { status: 303, headers });
  }

  const target = new URL(returnTo, url.origin);
  target.searchParams.set(
    'login',
    requestedResult === 'no_access' ? 'no_access' : 'success',
  );

  const headers = new Headers({ Location: target.toString() });
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return new Response(null, { status: 303, headers });
}
