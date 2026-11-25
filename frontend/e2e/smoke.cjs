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
    await page.goto(url + "/login.html");
    await page.getByRole("button", { name: "Entrar com IFSISTEM" }).waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Voltar ao portal" })
        .getAttribute("href"),
      "https://ifsistem-portal.onrender.com/",
    );
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
    await page.route("**/connect/logout?**", (route) =>
      route.fulfill({ body: "Logout do auth simulado" }),
    );
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.waitForURL("**/connect/logout?**");
    assert.equal(new URL(page.url()).searchParams.get("client_id"), "chaves");
    await page.goto(url + "/login.html");
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem("ifsistem-sso.chaves.tokens"),
      ),
      null,
    );
    await page.route("**/oauth2/authorize?**", (route) =>
      route.fulfill({ body: "Login do auth simulado" }),
    );
    await page.getByRole("button", { name: "Entrar com IFSISTEM" }).click();
    await page.waitForURL("**/oauth2/authorize?**");
    const authorize = new URL(page.url());
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorize.searchParams.get("client_id"), "chaves");
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
