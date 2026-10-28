'use strict';

/**
 * Explicit safe field allowlist.
 * Ensures credentials such as passwordHash are never sent in HTTP responses or stored in cookies.
 */
const SAFE_FIELDS = ['id', 'name', 'email'];

function toSafeUser(user) {
  if (!user) return null;
  const safe = {};
  for (const field of SAFE_FIELDS) {
    if (field in user) {
      safe[field] = user[field];
    }
  }
  return safe;
}

module.exports = {
  SAFE_FIELDS,
  toSafeUser,
};
