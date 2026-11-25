import { useEffect, useState, type ReactNode } from "react";
import { T, translate } from "../lib/i18n";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, Bot, Boxes, Building2, ClipboardList, CreditCard, Download, FileClock, LayoutDashboard, LogOut, Menu, Moon, Search, Shield, ShoppingCart,
  Sun, Trash2, UserCog, Users, Wallet, Contact, X,
} from "lucide-react";
import { api, post, useApi, useMe, type Me } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { Alert, Loading, cx } from "../components/ui";
import { Logo } from "./PublicLayout";

type NavItem = { to: string; label: string; icon: ReactNode; perm?: string; module?: string };

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("nx-theme", next ? "dark" : "light");
    } catch {}
  };
  return { dark, toggle };
}

export const can = (me: Me | null | undefined, perm: string) => !!me?.permissions.includes(perm);

function SubscriptionBanner({ me }: { me: Me }) {
  const { lang } = useI18n();
  const s = me.subscription;
  const d = (x: string | null) => (x ? new Date(x).toLocaleDateString(lang === "en" ? "en-GB" : "pt-PT") : "—");
  if (lang === "en") {
    const en: Record<string, [string, "warning" | "error" | "info"]> = {
      trial: [`Free trial with sample data until ${d(s.trialEndsAt)}.`, "info"],
      trial_expired: ["The trial has ended. Convert to a paid plan to continue.", "error"],
      pending_payment: ["The subscription is awaiting payment confirmation. Activation is automatic once paid.", "warning"],
      grace: ["Payment overdue: access stays normal until day 3.", "warning"],
      read_only: ["Payment overdue: read-only mode (view and export). Settle the invoice to edit again.", "error"],
      suspended: ["Subscription suspended for non-payment. Your data is preserved.", "error"],
      cancel_scheduled: [`Subscription canceled: access until ${d(s.currentPeriodEnd)}.`, "warning"],
      canceled: ["Subscription ended. You can export your data during the retention period.", "error"],
    };
    const m = en[s.state];
    if (!m) return null;
    return <div className="mb-4"><Alert tone={m[1]}>{m[0]} {can(me, "billing.view") && <Link to="/app/billing" className="font-semibold underline">{s.state === "trial" ? "Convert to a paid plan" : "View subscription"}</Link>}</Alert></div>;
  }
  const msg: Record<string, [string, "warning" | "error" | "info"]> = {
    trial: [`Demonstração gratuita com dados fictícios até ${s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString("pt-PT") : "—"}.`, "info"],
    trial_expired: ["A demonstração terminou. Converta para um plano pago para continuar.", "error"],
    pending_payment: ["A subscrição aguarda confirmação do pagamento. A ativação é automática após o pagamento.", "warning"],
    grace: ["Pagamento em atraso: o acesso mantém-se normal até ao 3.º dia.", "warning"],
    read_only: ["Pagamento em atraso: modo somente leitura (consulta e exportação). Regularize para voltar a editar.", "error"],
    suspended: ["Subscrição suspensa por falta de pagamento. Os seus dados estão preservados.", "error"],
    cancel_scheduled: [`Subscrição cancelada: acesso até ${s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("pt-PT") : "—"}.`, "warning"],
    canceled: ["Subscrição terminada. Pode exportar os seus dados durante o período de retenção.", "error"],
  };
  const m = msg[s.state];
  if (!m) return null;
  return (
    <div className="mb-4">
      <Alert tone={m[1]}>
        {m[0]} {s.state !== "trial" && can(me, "billing.view") && <Link to="/app/billing" className="font-semibold underline"><T>Ver subscrição</T></Link>}
        {s.state === "trial" && can(me, "billing.view") && <Link to="/app/billing" className="ml-1 font-semibold underline"><T>Converter para plano pago</T></Link>}
      </Alert>
    </div>
  );
}

/** Incidentes operacionais ativos comunicados pela equipa Nexora. */
function IncidentBanner() {
  const { lang } = useI18n();
  const { data } = useApi<any[]>(["incidents-active"], "/api/incidents/active", { refetchInterval: 120_000 });
  if (!data?.length) return null;
  const st: Record<string, string> = { investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved" };
  return (
    <div className="mb-4 space-y-2">
      {data.map((i) => (
        <Alert key={i.id} tone={i.severity === "critical" || i.severity === "high" ? "error" : "warning"}>
          <strong>{lang === "en" ? "Service incident" : "Incidente no serviço"}: {i.title}</strong> · {lang === "en" ? st[i.status] : i.statusLabel}
          {i.lastUpdate?.note && <span className="block text-xs">{i.lastUpdate.note}</span>}
        </Alert>
      ))}
    </div>
  );
}

function GlobalSearch() {
  const { tr } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data } = useApi<{ results: { type: string; id: string; title: string; link: string }[] }>(["search", q], q.trim().length >= 2 ? `/api/search?q=${encodeURIComponent(q)}` : null);
  return (
    <div className="relative hidden w-72 md:block">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
      <input className="input pl-8" placeholder={tr("Pesquisar clientes, produtos, pessoas…")} aria-label={tr("Pesquisa global")} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && q.length >= 2 && (
        <div className="card absolute z-40 mt-1 w-full p-1 shadow-lg">
          {!data?.results.length ? <p className="p-2 text-sm muted"><T>Sem resultados.</T></p> : data.results.map((r) => (
            <Link key={r.type + r.id} to={r.link} className="block rounded px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="mr-2 text-xs muted">{r.type}</span>{r.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { data: me, isLoading } = useMe();
  const { t, lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const notif = useApi<{ unread: number }>(["notifications"], me && !me.mfaPending ? "/api/notifications" : null, { refetchInterval: 60_000 });
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);
  // O idioma preferido do utilizador (guardado na conta) aplica-se ao entrar.
  useEffect(() => {
    if (me?.user.locale && (me.user.locale === "pt" || me.user.locale === "en") && me.user.locale !== lang) setLang(me.user.locale);
  }, [me?.user.id]); // eslint-disable-line

  if (isLoading) return <Loading />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (me.mfaPending) return <Navigate to="/login/2fa" replace />;
  if (me.mfaEnrollmentRequired && loc.pathname !== "/app/security") return <Navigate to="/app/security?enroll=1" replace />;

  const groups: { title: string; items: NavItem[] }[] = [
    { title: "", items: [{ to: "/app", label: t("dashboard"), icon: <LayoutDashboard className="h-4 w-4" />, perm: "dashboard.view" }, { to: "/app/ai", label: t("ai"), icon: <Bot className="h-4 w-4" />, perm: "ai.use" }] },
    {
      title: t("business"),
      items: [
        { to: "/app/customers", label: t("customers"), icon: <Contact className="h-4 w-4" />, perm: "crm.view", module: "crm" },
        { to: "/app/products", label: t("products"), icon: <Boxes className="h-4 w-4" />, perm: "inventory.view", module: "inventory" },
        { to: "/app/sales", label: t("sales"), icon: <ShoppingCart className="h-4 w-4" />, perm: "sales.view", module: "sales" },
        { to: "/app/finance", label: t("finance"), icon: <Wallet className="h-4 w-4" />, perm: "finance.view", module: "finance" },
      ],
    },
    {
      title: t("company"),
      items: [
        { to: "/app/employees", label: t("employees"), icon: <Users className="h-4 w-4" />, perm: "employees.view" },
        { to: "/app/users", label: t("users"), icon: <UserCog className="h-4 w-4" />, perm: "users.view" },
        { to: "/app/roles", label: t("roles"), icon: <Shield className="h-4 w-4" />, perm: "roles.view" },
        { to: "/app/billing", label: t("billing"), icon: <CreditCard className="h-4 w-4" />, perm: "billing.view" },
        { to: "/app/settings", label: t("settings"), icon: <Building2 className="h-4 w-4" /> },
      ],
    },
    {
      title: t("governance"),
      items: [
        { to: "/app/audit", label: t("audit"), icon: <ClipboardList className="h-4 w-4" />, perm: "audit.view" },
        { to: "/app/exports", label: t("exports"), icon: <Download className="h-4 w-4" /> },
        { to: "/app/trash", label: t("trash"), icon: <Trash2 className="h-4 w-4" />, perm: "trash.manage" },
        { to: "/app/security", label: t("security"), icon: <FileClock className="h-4 w-4" /> },
      ],
    },
  ];
  // Menu dinâmico: só módulos contratados e áreas autorizadas.
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => (!i.perm || can(me, i.perm)) && (!i.module || me.modules.includes(i.module))) })).filter((g) => g.items.length);

  const logout = async () => {
    await post("/api/auth/logout");
    qc.clear();
    nav("/login");
  };

  const sidebar = (
    <nav aria-label="Navegação principal" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <div className="px-2 py-1"><Logo /></div>
      {me.companies.length > 1 ? (
        <select className="input text-xs" aria-label="Empresa ativa" value={me.tenant.id} onChange={async (e) => { await post("/api/auth/switch-company", { tenantId: e.target.value }); qc.clear(); nav("/app"); }}>
          {me.companies.map((c) => <option key={c.tenantId} value={c.tenantId}>{c.name}</option>)}
        </select>
      ) : (
        <p className="truncate px-2 text-xs font-medium muted" title={me.tenant.name}>{me.tenant.name}</p>
      )}
      {visible.map((g) => (
        <div key={g.title}>
          {g.title && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => (
              <li key={i.to}>
                <NavLink end={i.to === "/app"} to={i.to} className={({ isActive }) => cx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm", isActive ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
                  {i.icon}{i.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto rounded-lg bg-slate-100 p-2 text-xs dark:bg-slate-800">
        <p className="font-medium">{me.subscription.plan.name}{me.tenant.isDemo && " · Demo"}</p>
        <p className="text-slate-600 dark:text-slate-300">{me.modules.length} módulo(s) ativo(s)</p>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-slate-900">
            <button className="absolute right-2 top-2 p-1" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <button className="rounded p-1.5 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <select aria-label="Idioma" className="rounded-md border-0 bg-transparent px-1 py-1 text-xs" value={lang} onChange={(e) => { setLang(e.target.value as any); api("/api/auth/me", { method: "PATCH", body: { locale: e.target.value } }).then(() => qc.invalidateQueries()).catch(() => {}); }}>
              <option value="pt">PT</option><option value="en">EN</option>
            </select>
            <button onClick={toggle} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={dark ? "Modo claro" : "Modo escuro"}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            {/* Nome acessível em texto oculto que inclui o número visível (WCAG 2.5.3 "Label in Name"). */}
            <Link to="/app/notifications" className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{translate(lang, "Notificações")}</span>
              {!!notif.data?.unread && <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">{notif.data.unread}<span className="sr-only"> {translate(lang, "por ler")}</span></span>}
            </Link>
            <span className="hidden px-2 text-sm sm:inline">{me.user.name}</span>
            <button onClick={logout} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t("logout")}><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <IncidentBanner />
          <SubscriptionBanner me={me} />
          <Outlet context={me} />
        </main>
      </div>
    </div>
  );
}
