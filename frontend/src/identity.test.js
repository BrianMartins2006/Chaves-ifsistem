import test from "node:test";
import assert from "node:assert/strict";
import { formatCpf, validCpf, validateRegistration } from "./identity.js";
test("CPF mask supports partial typing and pasted numbers", () => {
  assert.equal(formatCpf("90000000175"), "900.000.001-75");
  assert.equal(formatCpf("900.000.001-75"), "900.000.001-75");
  assert.equal(formatCpf("9000"), "900.0");
  assert.equal(formatCpf("90000000175999"), "900.000.001-75");
});
test("CPF check digits and repeated sequences", () => {
  assert.equal(validCpf("900.000.001-75"), true);
  for (const value of ["11111111111", "90000000174", "123", ""])
    assert.equal(validCpf(value), false);
});
const registration = {
  cpf: "900.000.001-75",
  cpfConfirmation: "90000000175",
  senha: "testing-only",
  passwordConfirmation: "testing-only",
  email: " ALUNO@ALUNOS.IFSULDEMINAS.EDU.BR ",
};
test("confirmation compares normalized CPF and strips auxiliary fields", () => {
  const result = validateRegistration(registration);
  assert.equal(result.cpf, "90000000175");
  assert.equal(result.email, "aluno@alunos.ifsuldeminas.edu.br");
  assert.equal("cpfConfirmation" in result, false);
  assert.equal("passwordConfirmation" in result, false);
});
test("CPF and password mismatches prevent sending registration", () => {
  assert.throws(
    () =>
      validateRegistration({ ...registration, cpfConfirmation: "90000000174" }),
    /CPFs não coincidem/,
  );
  assert.throws(
    () =>
      validateRegistration({
        ...registration,
        passwordConfirmation: "different",
      }),
    /senhas não coincidem/,
  );
  assert.throws(
    () => validateRegistration({ ...registration, cpf: "11111111111" }),
    /CPF inválido/,
  );
});
