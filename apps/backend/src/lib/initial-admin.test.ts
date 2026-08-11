import assert from "node:assert/strict";
import test from "node:test";
import { validateInitialAdmin } from "./initial-admin";

test("validates and normalizes the initial administrator", () => {
  assert.deepEqual(
    validateInitialAdmin({
      name: "  Administrador Geral  ",
      login: "  admin.geral  ",
      password: "senha-segura",
    }),
    {
      name: "Administrador Geral",
      login: "admin.geral",
      password: "senha-segura",
    },
  );
});

test("rejects an incomplete or weak initial administrator", () => {
  assert.throws(
    () =>
      validateInitialAdmin({ name: "", login: "admin", password: "12345678" }),
    /nome/i,
  );
  assert.throws(
    () =>
      validateInitialAdmin({ name: "Admin", login: "", password: "12345678" }),
    /login/i,
  );
  assert.throws(
    () =>
      validateInitialAdmin({
        name: "Admin",
        login: "admin",
        password: "curta",
      }),
    /8 caracteres/i,
  );
});
