import assert from "node:assert/strict";
import test from "node:test";
import { isValidCpf, stripCpfMask } from "./cpf";

test("normalizes a masked CPF", () => {
  assert.equal(stripCpfMask("529.982.247-25"), "52998224725");
});

test("accepts a valid CPF and rejects invalid or repeated digits", () => {
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("11111111111"), false);
});
