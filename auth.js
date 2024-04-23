const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';

const authMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  if (origin === allowedOrigin) {
    next();
  } else {
    res.status(403).json({ error: 'Acesso não autorizado' });
  }
};

module.exports = authMiddleware;
