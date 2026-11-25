const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const url = process.env.E2E_URL || "http://localhost:5173";
const jwt = (claims) =>
  [
    "eyJhbGciOiJSUzI1NiJ9",
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "test-signature",
  ].join(".");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      }),
      page = await context.newPage();
    const identity = {
      sub: "a9c996fa-f780-4903-b3df-e6b337a95e47",
      cpf: "90000000841",
      nome: "Aluno SSO",
      perfil: "ALUNO",
    };
    const access = jwt(identity),
      id = jwt({ ...identity, nonce: "test-nonce" });
    let apiCalls = 0;
    await page.route("**/oauth2/token", async (route) => {
      const body = new URLSearchParams(route.request().postData());
      assert.equal(body.get("client_id"), "chaves");
      assert.equal(body.get("code_verifier"), "test-verifier");
      await route.fulfill({
        json: {
          access_token: access,
          id_token: id,
          refresh_token: "test-refresh",
          expires_in: 3600,
        },
      });
    });
    await page.route("**/api/**", async (route) => {
      assert.equal(route.request().headers().authorization, "Bearer " + access);
      apiCalls++;
      await route.fulfill({
        json: route.request().url().includes("/api/rooms")
          ? [{ id: "sala-114", name: "Sala 114" }]
          : { content: [], totalPages: 0 },
      });
    });
    await page.goto(url + "/callback.html");
    await page.evaluate(() =>
      sessionStorage.setItem(
        "ifsistem-sso.chaves.pedido",
        JSON.stringify({
          state: "test-state",
          nonce: "test-nonce",
          verifier: "test-verifier",
        }),
      ),
    );
    await page.goto(url + "/callback.html?code=test-code&state=test-state");
    await page.getByRole("heading", { name: "Encontre seu espaço" }).waitFor();
    await page.getByRole("button", { name: /Sala 114/ }).waitFor();
    assert.ok(apiCalls > 0);
    assert.equal(
      await page.getByRole("button", { name: "Pessoas", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.reload();
    await page.getByRole("heading", { name: "Encontre seu espaço" }).waitFor();
    await page.route("**/oauth2/revoke", (route) =>
      route.fulfill({ status: 200, body: "" }),
    );
    await page.route("**/connect/logout?**", (route) => {
      assert.equal(
        new URL(route.request().url()).searchParams.get("client_id"),
        "chaves",
      );
      return route.fulfill({ status: 302, headers: { Location: url + "/" } });
    });
    await page.route("**/oauth2/authorize?**", (route) =>
      route.fulfill({ body: "Login do auth simulado" }),
    );
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.waitForURL("**/oauth2/authorize?**");
    for (const path of ["/", "/index.html", "/login.html"]) {
      await page.goto(url + path);
      await page.waitForURL("**/oauth2/authorize?**");
    }
    await page.goto(url + "/callback.html?code=invalid&state=invalid");
    await page.getByRole("alert").waitFor();
    assert.ok(
      await page.getByRole("button", { name: "Tentar novamente" }).isVisible(),
    );
    assert.ok(page.url().includes("/callback.html"));
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page.waitForURL("**/oauth2/authorize?**");
    const authorize = new URL(page.url());
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorize.searchParams.get("client_id"), "chaves");
    for (const perfil of ["ALUNO", "PROFESSOR", "SERVIDOR", "ADMINISTRADOR"]) {
      const roleContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const rolePage = await roleContext.newPage();
      await roleContext.addInitScript(
        ({ access }) => {
          sessionStorage.setItem(
            "ifsistem-sso.chaves.tokens",
            JSON.stringify({
              access,
              refresh: "mock",
              id: access,
              expiraEm: Math.floor(Date.now() / 1000) + 3600,
            }),
          );
        },
        { access: jwt({ ...identity, perfil }) },
      );
      await rolePage.route("**/api/**", (route) => route.fulfill({ json: [] }));
      await rolePage.goto(url + "/");
      await rolePage
        .getByRole("heading", { name: "Encontre seu espaço" })
        .waitFor();
      for (const path of ["/index.html", "/login.html"]) {
        await rolePage.goto(url + path);
        await rolePage.getByRole("heading", {name:"Encontre seu espaço"}).waitFor();
      }
      const link = rolePage.getByRole("button", {
        name: "Usuários",
        exact: true,
      });
      if (["SERVIDOR", "ADMINISTRADOR"].includes(perfil)) {
        assert.ok(await link.isVisible());
        let rows = [
          {
            id: "other-user",
            nome: "Maria SSO",
            email: "maria@ifsuldeminas.edu.br",
            matricula: "PRO-1",
            perfil: "PROFESSOR",
            ativo: true,
            status: "ATIVO",
          },
        ];
        await rolePage.route("**/usuarios**", async (route) => {
          const request = route.request();
          assert.ok(request.headers().authorization.startsWith("Bearer "));
          if (request.method() === "GET")
            return route.fulfill({
              json: {
                conteudo: rows,
                pagina: 0,
                totalPaginas: 1,
                totalElementos: rows.length,
              },
            });
          const body = request.postDataJSON();
          if (request.method() === "POST") {
            assert.equal(body.perfil, "PROFESSOR");
            assert.equal(body.senhaInicial, "Temporary123!");
            rows.push({
              id: "created",
              nome: body.nome,
              email: body.email,
              perfil: body.perfil,
              ativo: true,
              status: "ATIVO",
            });
            return route.fulfill({ status: 201, json: rows[1] });
          }
          if (request.method() === "PUT") {
            assert.equal(body.telefone, null);
            assert.equal(body.curso, null);
            rows[0] = { ...rows[0], ...body };
            return route.fulfill({ json: rows[0] });
          }
          return route.fulfill({
            status: 400,
            json: { status: 400, erro: "Erro de teste" },
          });
        });
        await link.click();
        await rolePage.getByText("Maria SSO", { exact: true }).waitFor();
        await rolePage
          .getByRole("button", { name: "Cadastrar usuário", exact: true })
          .click();
        await rolePage.getByLabel("Nome completo").fill("Novo professor");
        await rolePage
          .getByLabel("E-mail", { exact: true })
          .fill("novo@ifsuldeminas.edu.br");
        await rolePage.getByLabel("CPF", { exact: true }).fill("52998224725");
        await rolePage
          .getByLabel("Senha", { exact: true })
          .fill("Temporary123!");
        await rolePage
          .getByLabel("Confirmar senha", { exact: true })
          .fill("Temporary123!");
        await rolePage.getByRole("button", { name: "Salvar usuário" }).click();
        await rolePage
          .getByText("Alteração salva no IFSISTEM com sucesso.")
          .waitFor();
        await rolePage.getByText("Novo professor", { exact: true }).waitFor();
        await rolePage
          .getByRole("row")
          .filter({ hasText: "Maria SSO" })
          .getByRole("button", { name: "Editar", exact: true })
          .click();
        await rolePage.getByLabel("Nome completo").fill("Maria atualizada");
        await rolePage.getByRole("button", { name: "Salvar usuário" }).click();
        await rolePage.getByText("Maria atualizada", { exact: true }).waitFor();
      } else assert.equal(await link.count(), 0);
      assert.ok(
        await rolePage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await roleContext.close();
    }
    const slowContext = await browser.newContext();
    await slowContext.addInitScript(() => {
      window.addEventListener("DOMContentLoaded", () => {
        window.IfsistemSSO.getToken = () => new Promise(() => {});
      });
    });
    const slowPage = await slowContext.newPage();
    await slowPage.goto(url + "/login.html");
    await slowPage.locator(".sso-spinner").waitFor();
    assert.equal(
      await slowPage
        .getByText("Conectando ao IFSISTEM…", { exact: true })
        .count(),
      0,
    );
    await slowPage
      .getByText("Conectando ao IFSISTEM…", { exact: true })
      .waitFor({ timeout: 7000 });
    assert.equal(await slowPage.getByRole("button").count(), 0);
    await slowContext.close();
    console.log(
      "SSO_OK: callback, access token, identidade, sessao, logout, PKCE e celular; auth e API simulados.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
