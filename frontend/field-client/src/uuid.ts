/**
 * Gera um UUID v4 também em navegadores sem crypto.randomUUID(), como ocorre
 * no acesso provisório da VM por HTTP. Estes identificadores não são segredos;
 * getRandomValues continua sendo preferido quando estiver disponível.
 */
type UuidCrypto = Pick<Crypto, 'randomUUID' | 'getRandomValues'>;

export function createUuid(candidate: Partial<UuidCrypto> | undefined = globalThis.crypto): string {
  if (typeof candidate?.randomUUID === 'function') {
    return candidate.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof candidate?.getRandomValues === 'function') {
    candidate.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hexadecimal = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
}
