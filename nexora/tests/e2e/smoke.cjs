const { chromium } = require("playwright");
const OUT = (process.env.SHOTS_DIR || require("os").tmpdir()) + "/";
const B0 = process.env.BASE_URL || "http://localhost:5173";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));
  const B = B0;
  await page.goto(B + "/"); await page.screenshot({ path: OUT + "01-home.png" });
  await page.goto(B + "/precos"); await page.waitForSelector("text=Starter"); await page.screenshot({ path: OUT + "02-pricing.png" });
  await page.goto(B + "/login");
  await page.fill('input[type=email]', "demo@nexora.local");
  await page.fill('input[type=password]', "DemoNexora2026");
  await page.click("button:has-text('Entrar')");
  await page.waitForURL(/\/app/); await page.waitForSelector("text=Vendas do mês");
  await page.waitForTimeout(800); await page.screenshot({ path: OUT + "03-dashboard.png" });
  for (const [p, sel, name] of [["/app/customers", "text=Kianda", "04-customers"], ["/app/products", "text=SKU-001", "05-products"], ["/app/sales", "text=V-0", "06-sales"], ["/app/finance", "text=Salários", "07-finance"], ["/app/employees", "text=Ana Fictícia", "08-employees"], ["/app/users", "text=Vendedor Demo", "09-users"], ["/app/roles", "text=Diretor-geral", "10-roles"], ["/app/billing", "text=Faturas", "11-billing"], ["/app/audit", "text=Cadeia íntegra", "12-audit"], ["/app/security", "text=Sessões", "13-security"]]) {
    await page.goto(B + p); await page.waitForSelector(sel, { timeout: 10000 }); await page.screenshot({ path: OUT + name + ".png" });
  }
  // fluxo de venda
  await page.goto(B + "/app/sales"); await page.click("text=Nova venda");
  await page.locator("form select", { has: page.locator("option", { hasText: "SKU-" }) }).selectOption({ index: 1 });
  await page.click("button:has-text('Registar venda')"); await page.waitForSelector("text=Venda registada");
  // IA
  await page.goto(B + "/app/ai"); await page.click("text=Previsão de vendas"); await page.waitForSelector("text=intervalo de 80%", { timeout: 15000 });
  await page.fill('input[aria-label="Mensagem para a IA"]', "Ajustar stock do SKU-002: acrescentar 20 unidades"); await page.click('button[aria-label="Enviar"]'); await page.waitForSelector("text=aguardar aprovação", { timeout: 15000 });
  await page.screenshot({ path: OUT + "14-ai.png" });
  await page.goto(B + "/app/ai?tab=approvals"); await page.waitForSelector("text=Segregação"); await page.screenshot({ path: OUT + "15-approvals.png" });
  // mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.context().addCookies(await page.context().cookies());
  await m.goto(B + "/app"); await m.waitForSelector("text=Vendas do mês"); await m.screenshot({ path: OUT + "16-mobile.png" });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  // admin
  const a = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  await a.goto(B + "/admin/login"); await a.fill('input[type=email]', "admin@nexora.local"); await a.fill('input[type=password]', "ChangeMe!2026"); await a.click("button:has-text('Entrar')");
  await a.waitForSelector("text=MRR estimado"); await a.screenshot({ path: OUT + "17-admin.png" });
  // signup trial
  const s = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  await s.goto(B + "/registo"); await s.fill("input >> nth=0", "Teste E2E Lda");
  await s.click("text=Continuar"); await s.fill("input >> nth=0", "Pessoa E2E"); await s.fill('input[type=email]', `e2e${Date.now()}@test.invalid`); await s.fill('input[type=password]', "SenhaE2E12345");
  await s.click("text=Continuar"); await s.click("text=Continuar"); await s.check('input[type=checkbox]'); await s.click("text=Criar demonstração");
  await s.waitForURL(/security/); await s.waitForSelector("text=Configurar 2FA"); await s.screenshot({ path: OUT + "18-signup-2fa.png" });
  console.log(JSON.stringify({ errors, mobileOverflow: overflow }));
  if (errors.length || overflow) process.exitCode = 1;
  await browser.close();
})().catch((e) => { console.error("E2E FAIL", e.message); process.exit(1); });
