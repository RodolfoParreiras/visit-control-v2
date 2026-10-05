import { formatDateOnly } from '@/lib/utils';

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo, usada como limite do campo. */
export function todayInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return exists && value >= '1900-01-01' && value <= todayInSaoPaulo();
}

export function ageFromBirthDate(birthDate: string, today = todayInSaoPaulo()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number);
  const hadBirthday = currentMonth > month || (currentMonth === month && currentDay >= day);
  return currentYear - year - (hadBirthday ? 0 : 1);
}

/** Ex.: "20/05/1958 (67 anos)". */
export function formatBirthDate(birthDate: string | null | undefined): string {
  if (!birthDate) return 'Não informada';
  const age = ageFromBirthDate(birthDate);
  return `${formatDateOnly(birthDate)} (${age} ${age === 1 ? 'ano' : 'anos'})`;
}

/** Mesma regra do backend: 60+ é prioritário e 80+ tem prioridade especial. */
export function agePriorityLabel(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const age = ageFromBirthDate(birthDate);
  if (age >= 80) return 'Idoso 80+ (prioridade especial)';
  if (age >= 60) return 'Idoso 60+';
  return null;
}

export const manualPriorityOptions = [
  { value: 'pregnant', label: 'Gestante' },
  { value: 'lactating', label: 'Lactante' },
  { value: 'infant', label: 'Pessoa com criança de colo' },
  { value: 'disabled', label: 'Pessoa com deficiência' },
  { value: 'autism', label: 'Pessoa com TEA' },
  { value: 'obese', label: 'Pessoa obesa' },
] as const;

export function manualPriorityLabel(value: string | null | undefined): string | null {
  return manualPriorityOptions.find((option) => option.value === value)?.label ?? null;
}
