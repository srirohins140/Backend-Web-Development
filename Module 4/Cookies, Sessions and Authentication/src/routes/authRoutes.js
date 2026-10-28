'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const sessionStore = require('../session/sessionStore');
const userRepository = require('../repositories/userRepository');
const requireSession = require('../middleware/requireSession');
const { COOKIE_NAME, getCookieOptions, getClearCookieOptions } = require('../config/cookie');
const { toSafeUser } = require('../utils/userSerializer');

const router = express.Router();

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * POST /auth/login
 * Validates input, verifies credentials with bcrypt, creates a server session,
 * sets a signed httpOnly session cookie, and returns safe user fields.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' },
      });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Email and password cannot be empty' },
      });
    }

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Create opaque server-side session record { userId, expiresAt }
    const session = sessionStore.create(user.id);

    // Set signed cookie with centralized security options
    res.cookie(COOKIE_NAME, session.id, getCookieOptions());

    return res.status(200).json(toSafeUser(user));
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /auth/me
 * Protected identity endpoint that verifies the session cookie and returns safe fields.
 */
router.get('/me', requireSession, (req, res) => {
  return res.status(200).json(toSafeUser(req.user));
});

/**
 * POST /auth/logout
 * Destroys server-side session authority and clears the browser cookie.
 * Idempotent: safe to repeat, always returning 204.
 */
router.post('/logout', (req, res, next) => {
  try {
    const sid = req.signedCookies ? req.signedCookies[COOKIE_NAME] : null;
    if (sid) {
      sessionStore.destroy(sid);
    }

    res.clearCookie(COOKIE_NAME, getClearCookieOptions());
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
