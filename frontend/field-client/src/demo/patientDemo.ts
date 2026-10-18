const names = ['Marina Oliveira', 'Carlos Mendes', 'Renata Almeida', 'Paulo Ferreira'];

export function createPatientDemo(
  random: () => number = Math.random,
  now: number = Date.now(),
): Record<string, string> {
  const index = Math.min(names.length - 1, Math.floor(random() * names.length));
  const suffix = String(Math.abs(now)).padStart(9, '0').slice(-9);
  const base = /^([0-9])\1{8}$/.test(suffix) ? `1${suffix.slice(1)}` : suffix;
  const cpf = withCpfCheckDigits(base);
  const year = 1970 + Math.floor(random() * 30);

  return {
    fullName: names[index],
    documentType: 'CPF',
    documentNumber: `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`,
    birthDate: `${year}-05-12`,
    phone: `(51) 99999-${String(now % 10_000).padStart(4, '0')}`,
  };
}

function withCpfCheckDigits(base: string) {
  const first = checkDigit(base, 10);
  const second = checkDigit(`${base}${first}`, 11);
  return `${base}${first}${second}`;
}

function checkDigit(value: string, initialWeight: number) {
  const total = [...value].reduce((sum, digit, index) => sum + Number(digit) * (initialWeight - index), 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
