const express = require('express');
const postRoutes = require('./routes/postRoutes');
const { resetData } = require('./data/postStore');
const controller = require('./controllers/postController');
const http = require('./utils/http');

function createApp() {
  const app = express();
  app.use(express.json());

  // Public resource-oriented routes
  app.use('/', postRoutes);

  // Safe internal-failure route for demo and testing
  app.get('/explode', controller.explode);
  app.get('/test-error', controller.explode);

  // Handle unknown routes with consistent error envelope
  app.use((req, res) => {
    return http.sendError(res, 404, 'NOT_FOUND', 'Route not found');
  });

  // Centralised error handling middleware
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error('Unhandled server error:', err.message);
    return http.sendError(res, err.statusCode || 500, err.code || 'INTERNAL_ERROR', 'Something went wrong');
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = 3000;
  app.listen(port, () => {
    console.log(`Starter API listening on port ${port}`);
  });
}

module.exports = {
  createApp,
  resetData
};
