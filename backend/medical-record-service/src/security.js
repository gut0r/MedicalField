import jwt from 'jsonwebtoken';
import { config, readPublicKey } from './config.js';

let publicKey;

export function authenticate(req, res, next) {
  const [scheme, token] = (req.header('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'Token de acesso obrigatório' });
  }
  try {
    publicKey ??= readPublicKey();
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
    if (payload.token_type !== 'access' || !payload.professional_id) throw new Error('Tipo de token inválido');
    req.principal = {
      userId: payload.sub,
      professionalId: payload.professional_id,
      roles: payload.roles ?? [],
      displayName: payload.name ?? '',
    };
    next();
  } catch {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Token inválido ou expirado' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.some((role) => req.principal?.roles.includes(role))) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Permissão insuficiente' });
    }
    next();
  };
}

