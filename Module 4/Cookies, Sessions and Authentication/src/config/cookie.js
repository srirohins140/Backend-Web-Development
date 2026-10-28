'use strict';

const COOKIE_NAME = 'sid';

/**
 * Returns centralized cookie options used when creating/setting the session cookie.
 * Keeping this configuration centralized guarantees options cannot drift between login and logout.
 */
function getCookieOptions() {
  const isSecure = process.env.COOKIE_SECURE === 'true';
  const maxAge = Number(process.env.SESSION_TTL_MS || 3600000);

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    signed: true,
    path: '/',
    maxAge,
  };
}

/**
 * Returns matching options for clearing the session cookie on logout.
 * Path, domain, httpOnly, sameSite, secure, and signed attributes must match the original Set-Cookie.
 */
function getClearCookieOptions() {
  const isSecure = process.env.COOKIE_SECURE === 'true';

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    signed: true,
    path: '/',
  };
}

module.exports = {
  COOKIE_NAME,
  getCookieOptions,
  getClearCookieOptions,
};
