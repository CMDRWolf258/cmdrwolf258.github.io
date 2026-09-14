import {
  SESSION_COOKIE,
  clearCookie,
  safeReturnPath,
} from '../../../lib/auth.js';

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(
    url.searchParams.get('return') || '/mining.html#submit-mining-report',
  );

  const headers = new Headers({
    Location: new URL(returnTo, url.origin).toString(),
  });

  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  headers.set('Cache-Control', 'no-store');

  return new Response(null, { status: 302, headers });
}
