const DISCORD_API = 'https://discord.com/api/v10';

const SESSION_COOKIE = 'ten16_session';
const STATE_COOKIE = 'ten16_oauth_state';
const RETURN_COOKIE = 'ten16_oauth_return';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const STATE_TTL_SECONDS = 60 * 10;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=UTF-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    const key = eq >= 0 ? trimmed.slice(0, eq) : trimmed;
    if (key === name) return eq >= 0 ? trimmed.slice(eq + 1) : '';
  }
  return null;
}

export function cookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  return parts.join('; ');
}

export function clearCookie(name) {
  return cookie(name, '', { maxAge: 0 });
}

export function makeOAuthState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function safeReturnPath(value) {
  const fallback = '/mining.html#submit-mining-report';
  if (!value || typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function buildDiscordAuthorizeUrl(env, state) {
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.REDIRECT_URI,
    scope: 'identify guilds.members.read',
    state,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(env, code) {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord token exchange failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function fetchDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Discord user lookup failed (${response.status})`);
  }

  return response.json();
}

export async function resolveAccess(env, accessToken, user) {
  if (user.id === env.ADMIN_USER_ID) {
    return { access: 'site_admin', membershipVerified: true };
  }

  const response = await fetch(
    `${DISCORD_API}/users/@me/guilds/${encodeURIComponent(env.GUILD_ID)}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    return { access: 'no_access', membershipVerified: false };
  }

  const member = await response.json();
  const roles = Array.isArray(member.roles) ? member.roles : [];

  if (roles.includes(env.MEMBER_ROLE_ID)) {
    return { access: 'member', membershipVerified: true };
  }

  return { access: 'no_access', membershipVerified: true };
}

export function accessLabel(access) {
  return {
    site_admin: 'Site Admin',
    member: 'Mongrel Member',
    no_access: 'No Submission Access',
  }[access] || 'Public';
}

export async function createSession(env, user, accessInfo) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    sub: user.id,
    username: user.username || '',
    displayName: user.global_name || user.username || 'Discord User',
    avatar: user.avatar || null,
    access: accessInfo.access,
    membershipVerified: Boolean(accessInfo.membershipVerified),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const encoded = stringToBase64Url(JSON.stringify(payload));
  const signature = await hmacSign(env.SESSION_SECRET, encoded);
  return `${encoded}.${signature}`;
}

export async function readSession(request, env) {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return null;

  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const valid = await hmacVerify(env.SESSION_SECRET, encoded, signature);
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlToString(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || payload.v !== 1 || !payload.sub || !payload.exp || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(session) {
  return cookie(SESSION_COOKIE, session, { maxAge: SESSION_TTL_SECONDS });
}

export function canSubmitMining(session) {
  return Boolean(session && (session.access === 'member' || session.access === 'site_admin'));
}

export { SESSION_COOKIE, STATE_COOKIE, RETURN_COOKIE, STATE_TTL_SECONDS };

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hmacSign(secret, value) {
  const key = await hmacKey(secret);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signed));
}

async function hmacVerify(secret, value, signature) {
  try {
    const key = await hmacKey(secret);
    const bytes = base64UrlToBytes(signature);
    return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(value));
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stringToBase64Url(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToString(value) {
  return decoder.decode(base64UrlToBytes(value));
}
