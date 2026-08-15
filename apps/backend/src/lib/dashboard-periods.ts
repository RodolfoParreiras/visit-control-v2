const DASHBOARD_TIME_ZONE = "America/Sao_Paulo";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function saoPauloDateParts(reference: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function datesBetween(start: Date, end: Date) {
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(isoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function getDashboardPeriods(reference = new Date()) {
  const { year, month, day } = saoPauloDateParts(reference);
  const current = new Date(Date.UTC(year, month - 1, day));

  const weekStartDate = new Date(current);
  weekStartDate.setUTCDate(current.getUTCDate() - current.getUTCDay());
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

  const monthStartDate = new Date(Date.UTC(year, month - 1, 1));
  const monthEndDate = new Date(Date.UTC(year, month, 0));

  return {
    today: isoDate(current),
    weekStart: isoDate(weekStartDate),
    weekEnd: isoDate(weekEndDate),
    monthStart: isoDate(monthStartDate),
    monthEnd: isoDate(monthEndDate),
    weekDates: datesBetween(weekStartDate, weekEndDate),
    monthDates: datesBetween(monthStartDate, monthEndDate),
  };
}

export function formatDashboardDateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", {
    ...options,
    timeZone: "UTC",
  });
}
