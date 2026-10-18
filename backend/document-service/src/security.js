import jwt from 'jsonwebtoken';
import { config, readPublicKey } from './config.js';

let publicKey;
export function authenticate(req, res, next) {
  const [scheme, token] = (req.header('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Token obrigatório' });
  try {
    publicKey ??= readPublicKey();
    const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'], issuer: config.jwtIssuer, audience: config.jwtAudience });
    if (payload.token_type !== 'access') throw new Error('Tipo inválido');
    req.token = token;
    req.principal = { professionalId: payload.professional_id, roles: payload.roles ?? [] };
    next();
  } catch {
    res.status(401).json({ code: 'INVALID_TOKEN', message: 'Token inválido ou expirado' });
  }
}

export function requireClinicalOrAdmin(req, res, next) {
  if (!req.principal.roles.some((role) => ['ADMIN', 'MEDICO', 'ENFERMEIRO', 'SOCORRISTA'].includes(role))) {
    return res.status(403).json({ code: 'FORBIDDEN', message: 'Permissão insuficiente' });
  }
  next();
}

