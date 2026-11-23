const { randomUUID } = require("node:crypto");
const studentPassword = randomUUID() + "aA1!";
if (!process.env.ADMIN_CPF || !process.env.ADMIN_PASSWORD)
  throw Error("Informe ADMIN_CPF e ADMIN_PASSWORD do backend de teste.");
process.env.TMPDIR ||= require("node:os").tmpdir();
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Pacific/Honolulu",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.E2E_URL || "http://127.0.0.1:18084/");
    await page.screenshot({ path: process.env.TMPDIR + "/ifsistem-login.png" });
    await page
      .getByRole("button", { name: "Sou aluno e quero me cadastrar" })
      .click();
    for (const [label, value] of Object.entries({
      "Nome completo": "Aluno React",
      "E-mail institucional": "aluno-react@alunos.ifsuldeminas.edu.br",
      Matrícula: "aluno-react",
      CPF: "90000000760",
      Senha: studentPassword,
      Curso: "Computação",
      Período: "2",
    }))
      await page.getByLabel(label, { exact: true }).fill(value);
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page.getByText("Conta criada. Entre com seu CPF e senha.").waitFor();
    await page.getByLabel("CPF", { exact: true }).fill("90000000760");
    await page.getByLabel("Senha", { exact: true }).fill(studentPassword);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("heading", { name: "Encontre seu espaço" }).waitFor();
    await page.getByRole("button", { name: /Sala 114/ }).click();
    assert.equal(
      await page.getByRole("button", { name: "Pessoas", exact: true }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "Consultar disponibilidade" })
      .click();
    await page.getByText(/Fuso: America/).waitFor();
    await page
      .getByRole("button", { name: "Solicitar reserva", exact: true })
      .click();
    await page.getByText("Solicitação enviada para avaliação.").waitFor();
    await page.getByRole("button", { name: "Reservas", exact: true }).click();
    await page
      .getByRole("table")
      .getByText("Pendente", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Aprovar", exact: true }).count(),
      0,
    );
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.getByLabel("CPF", { exact: true }).fill(process.env.ADMIN_CPF);
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("heading", { name: "Encontre seu espaço" }).waitFor();
    await page.getByRole("button", { name: "Reservas", exact: true }).click();
    await page.getByRole("button", { name: "Aprovar", exact: true }).click();
    await page.getByText("Reserva aprovada.").waitFor();
    await page
      .getByRole("button", { name: "Controle de chaves", exact: true })
      .click();
    await page.getByLabel("Reserva aprovada").selectOption({ index: 1 });
    await page
      .getByRole("button", { name: "Registrar retirada", exact: true })
      .click();
    await page.getByText("Retirada registrada.").waitFor();
    await page
      .getByRole("button", { name: "Devolver chave", exact: true })
      .click();
    await page.getByText("Devolução registrada.").waitFor();
    await page.getByRole("button", { name: "Pessoas", exact: true }).click();
    await page.getByRole("heading", { name: "Usuários cadastrados" }).waitFor();
    await page.getByText("Aluno React", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Desativar", exact: true }).click();
    await page.getByText("INATIVO", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Salas e disponibilidade", exact: true })
      .click();
    await page.getByRole("heading", { name: "Encontre seu espaço" }).waitFor();
    await page.screenshot({
      path: process.env.TMPDIR + "/ifsistem-react-dashboard.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: process.env.TMPDIR + "/ifsistem-react-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "REACT_OK: signup/login aluno, reserva, permissoes por perfil, login admin, aprovacao, retirada/devolucao, gestao de usuarios, desativacao, desktop/mobile.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
