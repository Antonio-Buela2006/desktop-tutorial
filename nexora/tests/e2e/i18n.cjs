const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("nx-lang", "en"));
  const p = await ctx.newPage(); const errors = [];
  p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await p.goto((process.env.BASE_URL || "http://localhost:5173") + "/"); await p.waitForSelector("text=Your whole business in one place"); await p.screenshot({ path: (process.env.SHOTS_DIR || require("os").tmpdir()) + "/25-en-home.png" });
  await p.goto((process.env.BASE_URL || "http://localhost:5173") + "/faq"); await p.waitForSelector("text=Do I need a card for the trial?");
  await p.goto((process.env.BASE_URL || "http://localhost:5173") + "/login"); await p.fill('input[type=email]', "demo@nexora.local"); await p.fill('input[type=password]', "DemoNexora2026"); await p.click("button:has-text('Sign in')");
  await p.waitForURL(/\/app/);
  // a preferência da conta (pt) prevalece ao entrar; muda para EN pelo seletor (fica guardada na conta)
  await p.waitForSelector('select[aria-label]'); await p.selectOption('header select', "en"); await p.waitForSelector("text=Sales this month");
  await p.screenshot({ path: (process.env.SHOTS_DIR || require("os").tmpdir()) + "/26-en-dashboard.png" });
  for (const [path, sel] of [["/app/products", "Stock & inventory"], ["/app/billing", "Subscription & billing"], ["/app/settings", "Company settings"], ["/app/employees", "Register employee"], ["/app/ai", "Credits & usage"]]) {
    await p.goto((process.env.BASE_URL || "http://localhost:5173") + "" + path); await p.waitForSelector(`text=${sel}`, { state: "attached" });
  }
  await p.goto((process.env.BASE_URL || "http://localhost:5173") + "/app/settings"); await p.waitForSelector("text=Smart alerts"); await p.screenshot({ path: (process.env.SHOTS_DIR || require("os").tmpdir()) + "/27-en-settings.png", fullPage: true });
  // volta a PT para não afetar outros testes
  await p.selectOption('header select', "pt"); await p.waitForTimeout(500);
  console.log(JSON.stringify({ errors })); await b.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
