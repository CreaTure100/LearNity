const express = require('express');

function createTestApp(router, mountPath = '/') {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  app.use((err, req, res, next) => {
    if (!err) return next();
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Ошибка сервера' });
  });
  return app;
}

module.exports = { createTestApp };
