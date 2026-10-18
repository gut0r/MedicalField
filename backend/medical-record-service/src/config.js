import fs from 'node:fs';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://medicalfield_app:change-me@localhost:5432/medicalfield',
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH ?? '../auth-service/secrets/jwt-public.pem',
  jwtIssuer: process.env.JWT_ISSUER ?? 'medicalfield-auth',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'medicalfield-services',
  serviceName: 'medical-record-service',
};

export function readPublicKey() {
  return fs.readFileSync(config.jwtPublicKeyPath, 'utf8');
}

