const express = require('express');
const authService = require('../services/authService');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Request body must be a valid JSON object' },
      });
    }

    const safeUser = await authService.register(req.body);
    return res.status(201).json(safeUser);
  } catch (error) {
    if (error instanceof authService.AuthError) {
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Request body must be a valid JSON object' },
      });
    }

    const safeUser = await authService.login(req.body);
    return res.status(200).json(safeUser);
  } catch (error) {
    if (error instanceof authService.AuthError) {
      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    return next(error);
  }
});

module.exports = router;
