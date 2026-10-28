require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);

// Global error handler
app.use((error, req, res, next) => {
  // Express body-parser malformed JSON error
  if (error.type === 'entity.parse.failed' || (error instanceof SyntaxError && error.status === 400)) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Malformed JSON payload' },
    });
  }

  if (error.status && error.status !== 500) {
    return res.status(error.status).json({
      error: {
        code: error.code || 'BAD_REQUEST',
        message: error.message,
      },
    });
  }

  // Unexpected internal errors return controlled 500 output without raw Prisma or bcrypt details
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
