import assert from "node:assert/strict";
import test from "node:test";
import { ageOn, computePriority, isValidBirthDate } from "./priority";

test("calcula a idade considerando se o aniversário já passou", () => {
  assert.equal(ageOn("1965-10-05", "2025-10-05"), 60);
  assert.equal(ageOn("1965-10-06", "2025-10-05"), 59);
  assert.equal(ageOn("2000-02-29", "2025-02-28"), 24);
  assert.equal(ageOn("data", "2025-02-28"), null);
});

test("valida datas de nascimento", () => {
  assert.equal(isValidBirthDate("1990-05-20", "2025-10-05"), true);
  assert.equal(isValidBirthDate("2025-10-05", "2025-10-05"), true);
  assert.equal(isValidBirthDate("2025-10-06", "2025-10-05"), false);
  assert.equal(isValidBirthDate("1899-12-31", "2025-10-05"), false);
  assert.equal(isValidBirthDate("2023-02-29", "2025-10-05"), false);
  assert.equal(isValidBirthDate("20/05/1990", "2025-10-05"), false);
  assert.equal(isValidBirthDate(null, "2025-10-05"), false);
});

test("define a prioridade pela idade", () => {
  assert.deepEqual(computePriority("1990-01-01", null, "2025-10-05"), {
    level: 0,
    reason: null,
  });
  assert.deepEqual(computePriority("1965-10-05", null, "2025-10-05"), {
    level: 1,
    reason: "Idoso 60+",
  });
  assert.deepEqual(computePriority("1945-01-01", null, "2025-10-05"), {
    level: 2,
    reason: "Idoso 80+",
  });
});

test("combina a prioridade informada pela recepção com a idade", () => {
  assert.deepEqual(computePriority("1990-01-01", "pregnant", "2025-10-05"), {
    level: 1,
    reason: "Gestante",
  });
  assert.deepEqual(computePriority(null, "disabled", "2025-10-05"), {
    level: 1,
    reason: "Pessoa com deficiência",
  });
  assert.deepEqual(computePriority("1940-01-01", "disabled", "2025-10-05"), {
    level: 2,
    reason: "Idoso 80+ · Pessoa com deficiência",
  });
});
