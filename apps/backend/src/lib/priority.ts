/** Motivos de atendimento prioritário que a recepção pode informar. */
export const manualPriorityReasons = {
  pregnant: "Gestante",
  lactating: "Lactante",
  infant: "Pessoa com criança de colo",
  disabled: "Pessoa com deficiência",
  autism: "Pessoa com TEA",
  obese: "Pessoa obesa",
} as const;

export type ManualPriorityReason = keyof typeof manualPriorityReasons;

export function isManualPriorityReason(
  value: unknown,
): value is ManualPriorityReason {
  return typeof value === "string" && value in manualPriorityReasons;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): [number, number, number] | null {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

/** Valida uma data de nascimento no formato AAAA-MM-DD até a data de referência. */
export function isValidBirthDate(value: unknown, today: string): boolean {
  if (typeof value !== "string" || !parseDate(value)) return false;
  return value >= "1900-01-01" && value <= today;
}

/** Idade completa na data de referência (ambas no formato AAAA-MM-DD). */
export function ageOn(birthDate: string, referenceDate: string): number | null {
  const birth = parseDate(birthDate);
  const reference = parseDate(referenceDate);
  if (!birth || !reference) return null;
  let age = reference[0] - birth[0];
  if (
    reference[1] < birth[1] ||
    (reference[1] === birth[1] && reference[2] < birth[2])
  ) {
    age -= 1;
  }
  return age;
}

/**
 * Calcula a prioridade na fila: pessoas com 80 anos ou mais têm prioridade
 * especial (Lei 13.466/2017); pessoas com 60 anos ou mais e os casos
 * informados pela recepção entram na fila prioritária.
 */
export function computePriority(
  birthDate: string | null,
  manualReason: ManualPriorityReason | null,
  referenceDate: string,
): { level: 0 | 1 | 2; reason: string | null } {
  const age = birthDate ? ageOn(birthDate, referenceDate) : null;
  const reasons: string[] = [];
  let level: 0 | 1 | 2 = 0;

  if (age !== null && age >= 80) {
    level = 2;
    reasons.push("Idoso 80+");
  } else if (age !== null && age >= 60) {
    level = 1;
    reasons.push("Idoso 60+");
  }
  if (manualReason) {
    if (level === 0) level = 1;
    reasons.push(manualPriorityReasons[manualReason]);
  }

  return { level, reason: reasons.length ? reasons.join(" · ") : null };
}
