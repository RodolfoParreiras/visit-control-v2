/**
 * Removes all non-digit characters from a CPF string.
 */
export function stripCpfMask(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Validates a CPF using the official Brazilian algorithm.
 * Accepts CPF with or without mask.
 * Returns false for empty string.
 */
export function isValidCpf(cpf: string): boolean {
  const digits = stripCpfMask(cpf);

  if (digits.length !== 11) return false;

  // Reject sequences of identical digits (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factor - i);
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calcDigit(digits.slice(0, 9), 10);
  if (first !== parseInt(digits[9], 10)) return false;

  const second = calcDigit(digits.slice(0, 10), 11);
  if (second !== parseInt(digits[10], 10)) return false;

  return true;
}
