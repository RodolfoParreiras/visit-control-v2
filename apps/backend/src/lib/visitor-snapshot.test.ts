import assert from "node:assert/strict";
import test from "node:test";
import { resolveVisitorSnapshot } from "./visitor-snapshot";

const currentVisitor = {
  name: "Nome atual",
  cpf: "123",
  phone: "9999",
  company: "Empresa atual",
  city: "Cidade atual",
  id: 1,
};

test("uses the immutable visitor snapshot when one exists", () => {
  const result = resolveVisitorSnapshot(currentVisitor, {
    name: "Nome no atendimento",
    cpf: "98765432100",
    phone: "1111",
    company: "Empresa antiga",
    city: "Cidade antiga",
  });

  assert.deepEqual(result, {
    ...currentVisitor,
    name: "Nome no atendimento",
    cpf: "98765432100",
    phone: "1111",
    company: "Empresa antiga",
    city: "Cidade antiga",
  });
});

test("falls back to current visitor data for legacy visits", () => {
  const result = resolveVisitorSnapshot(currentVisitor, {
    name: null,
    cpf: "123",
    phone: null,
    company: null,
    city: null,
  });

  assert.equal(result, currentVisitor);
});
