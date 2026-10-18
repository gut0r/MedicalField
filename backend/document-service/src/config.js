import fs from 'node:fs';

export const config = {
  port: Number(process.env.PORT ?? 3002),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://medicalfield_app:change-me@localhost:5432/medicalfield',
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH ?? '../auth-service/secrets/jwt-public.pem',
  jwtIssuer: process.env.JWT_ISSUER ?? 'medicalfield-auth',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'medicalfield-services',
  patientServiceUrl: process.env.PATIENT_SERVICE_URL ?? 'http://127.0.0.1:8081',
  medicalRecordServiceUrl: process.env.MEDICAL_RECORD_SERVICE_URL ?? 'http://127.0.0.1:3001',
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM ?? 'MedicalField <no-reply@example.com>',
  },
};

export const readPublicKey = () => fs.readFileSync(config.jwtPublicKeyPath, 'utf8');

