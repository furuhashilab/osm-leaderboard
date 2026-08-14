import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** yyyyMMdd-HHmmss, for filenames — e.g. downloaded logs/CSVs (OSMLB_..., OSMLBtable_...). */
export function formatFileTimestamp(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}
