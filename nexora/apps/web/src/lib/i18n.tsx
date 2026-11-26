import { createContext, useContext, useState, type ReactNode } from "react";
import { EN } from "./en";

/** Internacionalização simples (PT/EN), preparada para mais idiomas. */
const dict = {
  pt: {
    dashboard: "Dashboard", customers: "Clientes", products: "Stock", sales: "Vendas", finance: "Finanças", employees: "Funcionários",
    users: "Utilizadores", roles: "Funções e permissões", billing: "Subscrição", ai: "Assistente IA", notifications: "Notificações",
    audit: "Auditoria", trash: "Lixeira", exports: "Exportar dados", security: "Segurança", settings: "Definições", logout: "Terminar sessão",
    search: "Pesquisar…", business: "Negócio", company: "Empresa", governance: "Governação", save: "Guardar", cancel: "Cancelar",
    create: "Criar", edit: "Editar", delete: "Eliminar", loading: "A carregar…", empty: "Sem registos.", noPermission: "Não tem permissão para ver esta área.",
    moduleNotContracted: "Este módulo não está contratado pela sua empresa.", previous: "Anterior", next: "Seguinte", actions: "Ações",
  },
  en: {
    dashboard: "Dashboard", customers: "Customers", products: "Inventory", sales: "Sales", finance: "Finance", employees: "Employees",
    users: "Users", roles: "Roles & permissions", billing: "Subscription", ai: "AI assistant", notifications: "Notifications",
    audit: "Audit log", trash: "Trash", exports: "Export data", security: "Security", settings: "Settings", logout: "Sign out",
    search: "Search…", business: "Business", company: "Company", governance: "Governance", save: "Save", cancel: "Cancel",
    create: "Create", edit: "Edit", delete: "Delete", loading: "Loading…", empty: "No records.", noPermission: "You do not have permission to view this area.",
    moduleNotContracted: "This module is not part of your company's subscription.", previous: "Previous", next: "Next", actions: "Actions",
  },
};
export type Lang = keyof typeof dict;
type Key = keyof (typeof dict)["pt"];

type TrFn = (s: string) => string;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; tr: TrFn }>({ lang: "pt", setLang: () => {}, t: (k) => k, tr: (s) => s });

/** Traduz um texto PT de interface; se não houver tradução, devolve o original. */
export function translate(lang: Lang, s: string) {
  if (lang === "pt" || !s) return s;
  const trimmed = s.trim();
  const hit = EN[trimmed];
  return hit === undefined ? s : s.replace(trimmed, hit);
}

/** Traduz nós de texto simples (string ou arrays com strings); outros nós ficam intactos. */
export function translateNode(lang: Lang, n: ReactNode): ReactNode {
  if (lang === "pt") return n;
  if (typeof n === "string") return translate(lang, n);
  if (Array.isArray(n)) return n.map((c) => (typeof c === "string" ? translate(lang, c) : c));
  return n;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("nx-lang") as Lang) || "pt";
    } catch {
      return "pt";
    }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("nx-lang", l);
    } catch {}
    document.documentElement.lang = l;
  };
  return <Ctx.Provider value={{ lang, setLang, t: (k) => dict[lang][k] ?? k, tr: (x) => translate(lang, x) }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Componente para texto estático em JSX: <T>Texto em português</T>. */
export function T({ children }: { children: string }) {
  const { lang } = useContext(Ctx);
  return <>{translate(lang, children)}</>;
}
