// Gera o manual do utilizador (docs/manuals/user.md e user.en.md) a partir da ajuda contextual
// da aplicação (src/lib/help.ts), para que nunca divirjam. `--check` falha se estiverem desatualizados (CI).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { HELP } from "../src/lib/help.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../../../docs/manuals");
const T = {
  pt: { title: "Manual do utilizador", note: "Gerado a partir da ajuda contextual da aplicação (botão \"?\" ou tecla ? em cada página). Não editar à mão: altere `apps/web/src/lib/help.ts` e corra `pnpm --filter @nexora/web manual`.", general: "Geral", how: "Como fazer", tips: "Bom saber",
    basics: ["**Entrar**: e-mail e palavra-passe; com 2FA, introduza o código da aplicação autenticadora.", "**Menu**: mostra apenas os módulos contratados e as áreas a que tem acesso.", "**Pesquisa global** (topo): clientes, produtos e pessoas que pode ver.", "**Tabelas**: pesquisa, ordenação por coluna e paginação; as ações aparecem conforme as suas permissões.", "**Idioma e tema**: PT/EN e modo claro/escuro no topo; o idioma fica guardado na conta.", "**Ajuda**: botão \"?\" no topo ou tecla ? para a ajuda da página atual."] },
  en: { title: "User manual", note: "Generated from the app's contextual help (\"?\" button or the ? key on each page). Do not edit by hand: change `apps/web/src/lib/help.ts` and run `pnpm --filter @nexora/web manual`.", general: "General", how: "How to", tips: "Good to know",
    basics: ["**Sign in**: email and password; with 2FA, enter the code from your authenticator app.", "**Menu**: shows only contracted modules and the areas you can access.", "**Global search** (top): customers, products and people you can see.", "**Tables**: search, sort by column and pagination; actions appear according to your permissions.", "**Language and theme**: PT/EN and light/dark mode at the top; the language is saved to your account.", "**Help**: the \"?\" button at the top or the ? key for help on the current page."] },
};

function render(lang) {
  const t = T[lang];
  const parts = [`# ${t.title}`, "", `> ${t.note}`, "", `## ${t.general}`, "", ...t.basics.map((b) => `- ${b}`), ""];
  for (const [route, bi] of Object.entries(HELP)) {
    const e = bi[lang];
    parts.push(`## ${e.title}`, "", `\`${route}\` — ${e.intro}`, "", `**${t.how}**`, "", ...e.steps.map((s, i) => `${i + 1}. ${s}`), "");
    if (e.tips.length) parts.push(`**${t.tips}**`, "", ...e.tips.map((s) => `- ${s}`), "");
  }
  return parts.join("\n");
}

const check = process.argv.includes("--check");
let stale = 0;
for (const [lang, file] of [["pt", "user.md"], ["en", "user.en.md"]]) {
  const target = path.join(out, file);
  const content = render(lang);
  if (check) {
    let cur = "";
    try { cur = readFileSync(target, "utf8"); } catch {}
    if (cur !== content) { console.error(`Desatualizado: docs/manuals/${file} (corra pnpm --filter @nexora/web manual)`); stale++; }
  } else {
    writeFileSync(target, content);
    console.log(`Escrito docs/manuals/${file}`);
  }
}
process.exitCode = stale ? 1 : 0;
