/** A calendar date this many days from today, as YYYY-MM-DD. */
export function daysFromToday(days: number): string {
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return new Date(today + days * 86_400_000).toISOString().slice(0, 10);
}

export const yesterday = () => daysFromToday(-1);
export const today = () => daysFromToday(0);
export const tomorrow = () => daysFromToday(1);
