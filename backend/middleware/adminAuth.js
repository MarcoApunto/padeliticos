export default function adminAuth(req, res, next) {
  const configuredKey = process.env.ADMIN_KEY;
  const suppliedKey = req.get('x-admin-key');

  if (!configuredKey) {
    return res.status(503).json({ error: 'ADMIN_KEY no está configurada' });
  }
  if (!suppliedKey || suppliedKey !== configuredKey) {
    return res.status(401).json({ error: 'Clave de administrador no válida' });
  }

  next();
}