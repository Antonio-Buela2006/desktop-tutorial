/**
 * Acessibilidade (spec 11.2: objetivo WCAG 2.2 AA) com axe-core: páginas públicas, aplicação
 * (tema claro e escuro) e portal Nexora. Falha se houver violações de impacto "serious" ou "critical".
 * Uso: BASE_URL=http://localhost:5173 node tests/e2e/a11y.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const B = process.env.BASE_URL || "http://localhost:5173";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page, label) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async (tags) => {
    // eslint-disable-next-line no-undef
    const res = await axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ") + " :: " + (n.failureSummary || "").split("\n").slice(1, 2).join("")) , count: v.nodes.length }));
  }, TAGS);
  return r.map((v) => ({ page: label, ...v }));
}

(async () => {
  const browser = await chromium.launch();
  const all = [];
  const pub = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  for (const p of ["/", "/funcionalidades", "/modulos", "/precos", "/seguranca", "/sobre", "/contacto", "/faq", "/login", "/registo", "/recuperar"]) {
    await pub.goto(B + p, { waitUntil: "networkidle" });
    all.push(...(await scan(pub, "public " + p)));
  }
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.goto(B + "/login");
    await page.fill("input[type=email]", "demo@nexora.local");
    await page.fill("input[type=password]", "DemoNexora2026");
    await page.click("button:has-text('Entrar')");
    await page.waitForURL(/\/app/);
    await page.evaluate((t) => { try { localStorage.setItem("nx-theme", t); } catch {} document.documentElement.classList.toggle("dark", t === "dark"); }, theme);
    for (const p of ["/app", "/app/customers", "/app/products", "/app/products?tab=transfers", "/app/sales", "/app/finance", "/app/employees", "/app/users", "/app/roles", "/app/billing", "/app/settings", "/app/ai", "/app/audit", "/app/exports", "/app/trash", "/app/notifications", "/app/security"]) {
      await page.goto(B + p, { waitUntil: "networkidle" });
      await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme);
      await page.waitForTimeout(300);
      all.push(...(await scan(page, `${theme} ${p}`)));
    }
    await ctx.close();
  }
  const adm = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await adm.goto(B + "/admin/login");
  await adm.fill("input[type=email]", "admin@nexora.local");
  await adm.fill("input[type=password]", "ChangeMe!2026");
  await adm.click("button:has-text('Entrar')");
  await adm.waitForSelector("text=MRR estimado");
  for (const p of ["/admin", "/admin/plans", "/admin/settings", "/admin/incidents"]) {
    await adm.goto(B + p, { waitUntil: "networkidle" });
    all.push(...(await scan(adm, "admin " + p)));
  }
  await browser.close();
  const grave = all.filter((v) => v.impact === "serious" || v.impact === "critical");
  const byRule = {};
  for (const v of all) (byRule[v.id] ??= { impact: v.impact, help: v.help, pages: [], examples: [] }).pages.push(v.page) && byRule[v.id].examples.length < 40 && byRule[v.id].examples.push(...v.nodes.slice(0, 2));
  console.log(JSON.stringify({ total: all.length, grave: grave.length, rules: byRule }, null, 1));
  process.exitCode = grave.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
