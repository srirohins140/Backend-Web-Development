'use strict';

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');

if (!process.env.COOKIE_SECRET) {
  throw new Error('COOKIE_SECRET is required');
}

const app = express();
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use('/auth', authRoutes);

// Global error handler
app.use((error, req, res, next) => {
  // Handle invalid JSON body payloads
  if (error.type === 'entity.parse.failed' || (error instanceof SyntaxError && error.status === 400)) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Malformed JSON payload' },
    });
  }

  // Safe internal error output without leaking Prisma or runtime internals
  console.error(error.message || 'Internal server error');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
});

const port = Number(process.env.PORT || 3000);
if (require.main === module) {
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
