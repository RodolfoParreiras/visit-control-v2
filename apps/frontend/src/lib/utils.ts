import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata datas recebidas da API no formato AAAA-MM-DD sem conversão de fuso.
 * `new Date('AAAA-MM-DD')` é interpretado como UTC e pode exibir o dia anterior
 * para usuários no Brasil.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '';

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
