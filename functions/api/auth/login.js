import {
  STATE_COOKIE,
  RETURN_COOKIE,
  STATE_TTL_SECONDS,
  buildDiscordAuthorizeUrl,
  cookie,
  makeOAuthState,
  safeReturnPath,
} from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const state = makeOAuthState();
  const returnTo = safeReturnPath(url.searchParams.get('return'));

  const headers = new Headers({
    Location: buildDiscordAuthorizeUrl(env, state),
  });

  headers.append(
    'Set-Cookie',
    cookie(STATE_COOKIE, state, { maxAge: STATE_TTL_SECONDS }),
  );

  headers.append(
    'Set-Cookie',
    cookie(RETURN_COOKIE, encodeURIComponent(returnTo), { maxAge: STATE_TTL_SECONDS }),
  );

  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 302, headers });
}
