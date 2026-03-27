export function monthStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonthsUTC(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

export function formatMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

export function daysInMonthUTC(monthStart: Date): number {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
}

export function dayOfMonthUTC(date: Date): number {
  return date.getUTCDate();
}

export function currentFortnight(date: Date): 1 | 2 {
  return dayOfMonthUTC(date) <= 15 ? 1 : 2;
}

export function fortnightBounds(monthStart: Date, fortnight: 1 | 2) {
  const daysInMonth = daysInMonthUTC(monthStart);
  if (fortnight === 1) {
    return { startDay: 1, endDay: 15, days: 15 };
  }

  return { startDay: 16, endDay: daysInMonth, days: daysInMonth - 15 };
}

export function isSameMonthUTC(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}
