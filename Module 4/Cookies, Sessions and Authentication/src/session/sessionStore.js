'use strict';

const crypto = require('crypto');

/**
 * In-memory Session Store
 *
 * Stores opaque session ID -> { userId, expiresAt }.
 * Never stores credentials, passwords, or full user records.
 *
 * NOTE ON PRODUCTION USAGE:
 * This in-memory Map implementation is strictly suitable for local execution,
 * testing, and learning environments. In multi-instance or production deployments,
 * server restarts wipe the memory and separate server processes cannot share state.
 * Production systems require a centralized, distributed expiring store such as Redis
 * or Memcached with native TTL and atomic session invalidation.
 */
class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Generates a cryptographically random session ID and saves { userId, expiresAt }.
   * @param {number|string} userId
   * @param {number} [ttlMs] - Optional session TTL in milliseconds
   * @returns {{ id: string, userId: number|string, expiresAt: number }}
   */
  create(userId, ttlMs) {
    const id = crypto.randomUUID();
    const ttl = Number(ttlMs || process.env.SESSION_TTL_MS || 3600000);
    const expiresAt = Date.now() + ttl;

    const record = {
      userId,
      expiresAt,
    };

    this.sessions.set(id, record);
    return { id, ...record };
  }

  /**
   * Resolves a session ID, removing expired records during reads.
   * @param {string} id - The opaque session identifier
   * @returns {{ userId: number|string, expiresAt: number } | null}
   */
  get(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }

    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    // Lazy expiration cleanup: remove expired session on read
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return null;
    }

    return session;
  }

  /**
   * Destroys a session record on the server, immediately revoking authority.
   * @param {string} id - The opaque session identifier
   * @returns {boolean}
   */
  destroy(id) {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return this.sessions.delete(id);
  }

  /**
   * Clears all sessions (useful for tests and resets).
   */
  clear() {
    this.sessions.clear();
  }
}

module.exports = new SessionStore();
