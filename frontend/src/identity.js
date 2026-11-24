export const cpfDigits = (value) => String(value || "").replace(/\D/g, "");
export function formatCpf(value) {
  return cpfDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
export function validCpf(value) {
  const digits = cpfDigits(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (let p = 9; p < 11; p++) {
    let sum = 0;
    for (let i = 0; i < p; i++) sum += Number(digits[i]) * (p + 1 - i);
    const digit = 11 - (sum % 11);
    if (Number(digits[p]) !== (digit >= 10 ? 0 : digit)) return false;
  }
  return true;
}
export function validateRegistration(data) {
  if (!validCpf(data.cpf))
    throw Error("CPF inválido. Confira os números e os dígitos verificadores.");
  if (cpfDigits(data.cpf) !== cpfDigits(data.cpfConfirmation))
    throw Error("Os CPFs não coincidem. Confira a confirmação.");
  if (data.senha !== data.passwordConfirmation)
    throw Error(
      "As senhas não coincidem. Digite a mesma senha nos dois campos.",
    );
  const { cpfConfirmation, passwordConfirmation, ...request } = data;
  return {
    ...request,
    cpf: cpfDigits(data.cpf),
    email: data.email.trim().toLowerCase(),
  };
}
