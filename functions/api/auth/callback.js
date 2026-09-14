import {
  STATE_COOKIE,
  RETURN_COOKIE,
  SESSION_COOKIE,
  clearCookie,
  createSession,
  exchangeDiscordCode,
  fetchDiscordUser,
  getCookie,
  resolveAccess,
  safeReturnPath,
  sessionCookie,
} from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const savedState = getCookie(request, STATE_COOKIE);
  const storedReturn = getCookie(request, RETURN_COOKIE);
  const returnTo = safeReturnPath(
    storedReturn
      ? decodeURIComponent(storedReturn)
      : '/mining.html#submit-mining-report',
  );

  if (error) {
    return redirectWithResult(url.origin, returnTo, 'denied');
  }

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return redirectWithResult(url.origin, returnTo, 'state_error');
  }

  try {
    const token = await exchangeDiscordCode(env, code);
    const user = await fetchDiscordUser(token.access_token);
    const accessInfo = await resolveAccess(env, token.access_token, user);
    const session = await createSession(env, user, accessInfo);

    const finish = new URL('/api/auth/complete', url.origin);
    finish.searchParams.set('return', returnTo);
    finish.searchParams.set(
      'result',
      accessInfo.access === 'no_access' ? 'no_access' : 'success',
    );

    const headers = new Headers({ Location: finish.toString() });
    headers.append('Set-Cookie', sessionCookie(session));
    headers.append('Set-Cookie', clearCookie(STATE_COOKIE));
    headers.append('Set-Cookie', clearCookie(RETURN_COOKIE));
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.error('10-16 OAuth callback failed', error);
    return redirectWithResult(url.origin, returnTo, 'server_error');
  }
}

function redirectWithResult(origin, returnTo, result) {
  const target = new URL(returnTo, origin);
  target.searchParams.set('login', result);

  const headers = new Headers({ Location: target.toString() });
  headers.append('Set-Cookie', clearCookie(STATE_COOKIE));
  headers.append('Set-Cookie', clearCookie(RETURN_COOKIE));
  headers.append('Set-Cookie', clearCookie(SESSION_COOKIE));
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return new Response(null, { status: 303, headers });
}
