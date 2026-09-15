// Clave de acceso a la ZONA DE APUESTAS (oculta), leída del ENV (solo el
// servidor conoce su nombre). Con esta clave los apostadores entran y colocan
// apuestas. Las operaciones económicas (recargar Megalitos, crear apostador
// con saldo) exigen ADEMÁS la clave de administrador (adminAuth).
export default function betsAuth(req, res, next) {
  const configuredKey = process.env.BETS_KEY;
  const suppliedKey = req.get('x-bets-key');

  if (!configuredKey) {
    return res.status(503).json({ error: 'Clave de apuestas no configurada' });
  }
  if (!suppliedKey || suppliedKey !== configuredKey) {
    return res.status(401).json({ error: 'Clave de apuestas no válida' });
  }

  next();
}