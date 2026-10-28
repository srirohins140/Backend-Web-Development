'use strict';

const sessionStore = require('../session/sessionStore');
const userRepository = require('../repositories/userRepository');
const { COOKIE_NAME } = require('../config/cookie');

/**
 * Authentication middleware that verifies the signed session cookie,
 * resolves the live session in the server-side store, verifies the user,
 * and attaches safe user identity to the request.
 *
 * Rejects missing, invalid, expired, or orphaned sessions with an identical
 * generic 401 response so internal failure modes are never revealed.
 */
module.exports = async function requireSession(req, res, next) {
  try {
    const sid = req.signedCookies ? req.signedCookies[COOKIE_NAME] : null;

    // Cookie is absent or cookie signature failed tampering check (cookie-parser sets false)
    if (!sid) {
      return res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      });
    }

    // Resolve server session record
    const session = sessionStore.get(sid);
    if (!session) {
      return res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      });
    }

    // Resolve safe identity from repository
    const user = await userRepository.findPublicById(session.userId);
    if (!user) {
      // Clean up orphaned session whose user account was deleted
      sessionStore.destroy(sid);
      return res.status(401).json({
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      });
    }

    req.user = user;
    req.sessionId = sid;
    return next();
  } catch (error) {
    return next(error);
  }
};
