import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, Lock, X } from "lucide-react";
import { ApiError } from "../lib/api";
import { translate, translateNode, useI18n } from "../lib/i18n";

const useTr = () => { const { lang } = useI18n(); return { tx: (v?: string) => (v === undefined ? v : translate(lang, v)), tn: (n: ReactNode) => translateNode(lang, n), lang }; };

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; loading?: boolean; size?: "sm" | "md" };
export function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }: BtnProps) {
  const { tn, tx } = useTr();
  if (typeof rest["aria-label"] === "string") rest["aria-label"] = tx(rest["aria-label"]);
  if (typeof rest.title === "string") rest.title = tx(rest.title);
  const v = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  }[variant];
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50", size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm", v, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {tn(children)}
    </button>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const { tx } = useTr();
  return (
    <label className="block">
      <span className="label">{tx(label)}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs muted">{tx(hint)}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400" role="alert">{error}</span>}
    </label>
  );
}

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  const { tx } = useTr();
  return <input {...p} placeholder={tx(p.placeholder)} aria-label={tx(p["aria-label"])} className={cx("input", p.className)} />;
}

/** Select que traduz o texto das <option> simples. */
export function Select({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  const { tx, lang } = useTr();
  const kids = lang === "pt" ? children : Children.map(children, (c) => (isValidElement(c) && c.type === "option" && typeof (c.props as any).children === "string" ? cloneElement(c as any, {}, tx((c.props as any).children)) : c));
  return <select {...p} aria-label={tx(p["aria-label"])} className={cx("input", p.className)}>{kids}</select>;
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  const { tn } = useTr();
  title = tn(title);
  return (
    <section className={cx("card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const badgeTones = {
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  blue: "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-100",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  const { tn } = useTr();
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>{tn(children)}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const { tx, tn } = useTr();
  title = tx(title)!;
  subtitle = tn(subtitle);
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "A carregar…" }: { label?: string }) {
  const { tx } = useTr();
  return (
    <div className="flex items-center gap-2 p-6 text-sm muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {tx(label)}
    </div>
  );
}

export function Empty({ title = "Sem registos.", children }: { title?: string; children?: ReactNode }) {
  const { tx } = useTr();
  title = tx(title)!;
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm muted">
      <Inbox className="h-8 w-8" aria-hidden />
      <p>{title}</p>
      {children}
    </div>
  );
}

/** Estados de erro claros: sem permissão, módulo não contratado, subscrição suspensa, erro genérico. */
/** Mensagens de erro da API em inglês, por código (a API responde em português). */
const ERROR_EN: Record<string, string> = {
  UNAUTHENTICATED: "Your session has expired. Please sign in again.", FORBIDDEN: "You do not have permission for this operation.", NOT_FOUND: "Not found.",
  MODULE_NOT_CONTRACTED: "This module is not part of your company's subscription.", SUBSCRIPTION_READ_ONLY: "Subscription is read-only due to an overdue payment.",
  SUBSCRIPTION_SUSPENDED: "Operational access is suspended. Settle the subscription to continue.", LIMIT_REACHED: "You have reached your plan limit. Buy extra capacity or upgrade; existing accounts and records keep working.",
  INVALID_CREDENTIALS: "Incorrect email or password.", ACCOUNT_LOCKED: "Too many failed attempts. Try again later or reset your password.", INVALID_CODE: "Invalid code.",
  MFA_REQUIRED: "Enter your two-factor authentication code.", MFA_ENROLLMENT_REQUIRED: "Your company requires 2FA. Set it up to continue.", RATE_LIMITED: "Too many requests. Please wait a moment.",
  INSUFFICIENT_STOCK: "Insufficient stock at this location.", SEGREGATION_OF_DUTIES: "You cannot approve an operation you requested (segregation of duties).",
  AI_CREDITS_EXHAUSTED: "AI credits are exhausted. Everything else keeps working; buy a pack or upgrade to use AI again.", AI_DISABLED: "AI is disabled by your company.",
  BRANCH_OUT_OF_SCOPE: "That branch is outside your scope.", BRANCH_REQUIRED: "Choose a branch.", FILE_TYPE_NOT_ALLOWED: "File type not allowed.", FILE_TOO_LARGE: "File too large (max. 10 MB).",
  FILE_INFECTED: "The file was blocked by the antivirus.", EMAIL_EXISTS: "An account with this email already exists. Sign in to continue.", PRICE_PENDING: "This plan's price has not been set yet. Use the free trial.",
  IP_TEMPORARILY_BLOCKED: "Too many failed attempts from this network. Try again later.", LEGAL_HOLD: "The company is under legal hold.", CSRF: "Request rejected (CSRF).",
};
export const errorMessage = (e: ApiError | null | undefined, lang: string) => (e ? (lang === "en" && ERROR_EN[e.code]) || e.message : "");

export function ErrorState({ error }: { error: unknown }) {
  const { tx, lang } = useTr();
  const e = error instanceof ApiError ? error : null;
  const map: Record<string, string> = {
    FORBIDDEN: "Não tem permissão para ver esta área.",
    MODULE_NOT_CONTRACTED: "Este módulo não está contratado pela sua empresa. Pode ativá-lo em Subscrição.",
    SUBSCRIPTION_SUSPENDED: "O acesso operacional está suspenso. Regularize a subscrição para continuar.",
    SUBSCRIPTION_READ_ONLY: "Subscrição em modo somente leitura por pagamento em atraso.",
  };
  const msg = (lang === "en" && e && ERROR_EN[e.code]) || tx((e && map[e.code]) || e?.message || "Ocorreu um erro inesperado.");
  const icon = e?.status === 403 ? <Lock className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />;
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-600 dark:text-slate-300" role="alert">
      <span className="text-amber-500">{icon}</span>
      <p className="max-w-md">{msg}</p>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const { tn } = useTr();
  children = tn(children);
  const t = {
    info: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-900/30 dark:text-brand-100",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
    error: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  }[tone];
  return <div className={cx("rounded-lg border px-3 py-2 text-sm", t)} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function ErrorText({ error }: { error: unknown }) {
  const { lang } = useTr();
  if (!error) return null;
  const e = error as ApiError;
  const fields = e?.details?.fields as Record<string, string> | undefined;
  const problems = e?.details?.problems as string[] | undefined;
  return (
    <Alert tone="error">
      {errorMessage(e, lang)}
      {fields && <ul className="mt-1 list-disc pl-5">{Object.entries(fields).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>}
      {problems && <ul className="mt-1 list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
    </Alert>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { tx } = useTr();
  title = tx(title)!;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={cx("card max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** Confirmação explícita para ações destrutivas. */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: ReactNode; resolve: (v: boolean) => void; danger?: boolean } | null>(null);
  const confirm = (title: string, body: ReactNode, danger = true) => new Promise<boolean>((resolve) => setState({ title, body, resolve, danger }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ""}>
      <div className="text-sm">{state?.body}</div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => close(false)}>Cancelar</Button>
        <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)}>Confirmar</Button>
      </div>
    </Modal>
  );
  return { confirm, dialog };
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  const { tx } = useTr();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900" role="status">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 dark:text-emerald-600" /> {tx(message)}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  return { toast: setMsg, toastEl: <Toast message={msg} onDone={() => setMsg(null)} /> };
}

export type Column<T> = { key: string; header: string; render?: (row: T) => ReactNode; sortable?: boolean; className?: string };

/** Tabela com pesquisa, ordenação, paginação e estados vazios/erro (dados paginados no servidor). */
export function DataTable<T extends { id?: string }>({
  columns, rows, total, page, pageSize, onPage, loading, error, search, onSearch, sort, onSort, toolbar, rowKey,
}: {
  columns: Column<T>[]; rows: T[] | undefined; total?: number; page?: number; pageSize?: number; onPage?: (p: number) => void; loading?: boolean; error?: unknown;
  search?: string; onSearch?: (s: string) => void; sort?: { key: string; dir: "asc" | "desc" }; onSort?: (k: string) => void; toolbar?: ReactNode; rowKey?: (r: T) => string;
}) {
  const pages = total && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const { tx, lang } = useTr();
  return (
    <div className="card overflow-hidden">
      {(onSearch || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          {onSearch && <Input aria-label="Pesquisar" placeholder="Pesquisar…" value={search ?? ""} onChange={(e) => onSearch(e.target.value)} className="max-w-xs" />}
          <div className="ml-auto flex flex-wrap gap-2">{toolbar}</div>
        </div>
      )}
      {error ? (
        <ErrorState error={error} />
      ) : loading && !rows ? (
        <Loading />
      ) : !rows?.length ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cx("th", c.className)} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.sortable && onSort ? <button className="uppercase" onClick={() => onSort(c.key)}>{tx(c.header)} {sort?.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}</button> : tx(c.header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r, i) => (
                <tr key={rowKey ? rowKey(r) : r.id ?? i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {columns.map((c) => <td key={c.key} className={cx("td", c.className)}>{c.render ? c.render(r) : String((r as any)[c.key] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {onPage && total !== undefined && total > (pageSize ?? 20) && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
          <span className="muted">{lang === "en" ? `${total} records · page ${page} of ${pages}` : `${total} registos · página ${page} de ${pages}`}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={(page ?? 1) <= 1} onClick={() => onPage((page ?? 1) - 1)}>Anterior</Button>
            <Button size="sm" variant="secondary" disabled={(page ?? 1) >= pages} onClick={() => onPage((page ?? 1) + 1)}>Seguinte</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Aviso de perda de alterações não guardadas ao sair da página. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "up" | "down" }) {
  const { tx, tn } = useTr();
  label = tx(label)!;
  hint = tn(hint);
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className={cx("mt-1 text-xs", tone === "up" ? "text-emerald-700 dark:text-emerald-400" : tone === "down" ? "text-rose-600 dark:text-rose-400" : "muted")}>{hint}</p>}
    </div>
  );
}
