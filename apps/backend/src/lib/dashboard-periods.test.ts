import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardPeriods } from "./dashboard-periods";

test("calcula a semana vigente de domingo a sábado", () => {
  const periods = getDashboardPeriods(new Date("2026-08-19T15:00:00Z"));
  assert.equal(periods.today, "2026-08-19");
  assert.equal(periods.weekStart, "2026-08-16");
  assert.equal(periods.weekEnd, "2026-08-22");
  assert.equal(periods.weekDates.length, 7);
});

test("calcula o mês civil completo, inclusive em ano bissexto", () => {
  const periods = getDashboardPeriods(new Date("2024-02-15T15:00:00Z"));
  assert.equal(periods.monthStart, "2024-02-01");
  assert.equal(periods.monthEnd, "2024-02-29");
  assert.equal(periods.monthDates.length, 29);
});

test("respeita a data de São Paulo na virada UTC", () => {
  const periods = getDashboardPeriods(new Date("2026-08-16T01:30:00Z"));
  assert.equal(periods.today, "2026-08-15");
  assert.equal(periods.weekStart, "2026-08-09");
  assert.equal(periods.weekEnd, "2026-08-15");
});
