import { useEffect, useState } from "react";
import { T } from "../../lib/i18n";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, fmtDate, fmtDateTime, fmtMoney, fmtNum, get, post, put, useAction, useApi } from "../../lib/api";
import { Alert, Badge, Button, Card, DataTable, ErrorState, ErrorText, Field, Input, Loading, Modal, PageHeader, Select, Stat, cx } from "../../components/ui";
import { Logo } from "../../layouts/PublicLayout";

function useAdmin() {
  return useQuery({ queryKey: ["admin-me"], queryFn: async () => { try { return await get("/api/admin/me"); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; } } });
}

export function AdminLogin() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ email: "", password: "", code: "" });
  const [err, setErr] = useState<unknown>(null);
  const [needCode, setNeedCode] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form className="card w-full max-w-sm space-y-4 p-6" onSubmit={async (e) => {
        e.preventDefault();
        try { await post("/api/admin/auth/login", { email: f.email, password: f.password, code: f.code || undefined }); await qc.invalidateQueries({ queryKey: ["admin-me"] }); nav("/admin"); }
        catch (x) { if (x instanceof ApiError && x.code === "MFA_REQUIRED") setNeedCode(true); else setErr(x); }
      }}>
        <Logo /><p className="text-sm font-semibold"><T>Portal administrativo Nexora</T></p>
        <p className="text-xs muted"><T>Acesso restrito à equipa Nexora. Todas as ações são auditadas.</T></p>
        {err ? <ErrorText error={err} /> : null}
        <Field label="E-mail"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Palavra-passe"><Input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {needCode && <Field label="Código 2FA"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>}
        <Button className="w-full"><T>Entrar</T></Button>
        {import.meta.env.DEV && <p className="text-xs muted"><T>Dev: admin@nexora.local / ChangeMe!2026</T></p>}
      </form>
    </div>
  );
}

export function AdminLayout() {
  const { data: me, isLoading } = useAdmin();
  const nav = useNavigate();
  const qc = useQueryClient();
  if (isLoading) return <Loading />;
  if (!me) return <Navigate to="/admin/login" replace />;
  const items = [["/admin", "Visão geral", "tenants"], ["/admin/plans", "Planos e preços", "commercial"], ["/admin/modules", "Catálogo de módulos", "commercial"], ["/admin/payments", "Pagamentos", "payments"], ["/admin/settings", "Parâmetros globais", "settings"], ["/admin/support", "Suporte", "support"], ["/admin/incidents", "Incidentes", "tenants"], ["/admin/retention", "Retenção", "tenants"], ["/admin/audit", "Auditoria", "audit"]].filter(([, , a]) => me.areas.includes(a));
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Logo className="text-white" /><Badge tone="amber"><T>Portal Nexora</T></Badge>
          <nav className="flex flex-wrap gap-1 text-sm">{items.map(([to, l]) => <NavLink key={to} end={to === "/admin"} to={to} className={({ isActive }) => cx("rounded px-2 py-1", isActive ? "bg-white/15" : "text-slate-300 hover:text-white")}><T>{l}</T></NavLink>)}</nav>
          <div className="ml-auto flex items-center gap-2 text-sm">{me.email} <Badge>{me.role}</Badge>{!me.totpEnabled && <Link to="/admin/2fa" className="text-amber-300 underline"><T>Ativar 2FA</T></Link>}<button className="underline" onClick={async () => { await post("/api/admin/auth/logout"); qc.clear(); nav("/admin/login"); }}><T>Sair</T></button></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6"><Outlet /></main>
    </div>
  );
}

export function AdminOverview() {
  const metrics = useApi<any>(["admin-metrics"], "/api/admin/metrics");
  const tenants = useApi<any[]>(["admin-tenants"], "/api/admin/tenants");
  const [extend, setExtend] = useState<any | null>(null);
  return (
    <>
      <PageHeader title="Visão geral" subtitle="Métricas agregadas e metadados de empresas. Sem acesso a dados empresariais." />
      {metrics.data && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Empresas" value={metrics.data.tenants} hint={Object.entries(metrics.data.byStatus).map(([k, v]) => `${k}: ${v}`).join(" · ")} />
          <Stat label="MRR estimado" value={fmtMoney(metrics.data.mrrEstimate)} hint={metrics.data.note} />
          <Stat label="Utilizadores ativos" value={fmtNum(metrics.data.activeUsers)} />
          <Stat label="Créditos IA consumidos" value={fmtNum(metrics.data.aiCreditsConsumed)} hint={`${metrics.data.pendingPayments} pagamento(s) pendente(s)`} />
        </div>
      )}
      <DataTable rows={tenants.data} loading={tenants.isLoading} error={tenants.error} columns={[
        { key: "name", header: "Empresa", render: (r: any) => <span className="font-medium">{r.name}{r.isDemo && <Badge tone="blue"><T>demo</T></Badge>}</span> },
        { key: "plan", header: "Plano" },
        { key: "accessState", header: "Estado", render: (r: any) => <Badge tone={["active", "trial"].includes(r.accessState) ? "green" : ["grace", "pending_payment", "cancel_scheduled"].includes(r.accessState) ? "amber" : "red"}>{r.accessState}</Badge> },
        { key: "usage", header: "Uso", render: (r: any) => `${r.usage.users} util. · ${r.usage.employees} func. · ${r.usage.modules} mód.` },
        { key: "createdAt", header: "Registo", render: (r: any) => fmtDate(r.createdAt) },
        { key: "a", header: "", render: (r: any) => r.accessState.startsWith("trial") && <Button size="sm" variant="secondary" onClick={() => setExtend(r)}><T>Prolongar demo</T></Button> },
      ]} />
      {extend && <ExtendTrial tenant={extend} onClose={() => setExtend(null)} />}
    </>
  );
}

function ExtendTrial({ tenant, onClose }: { tenant: any; onClose: () => void }) {
  const [f, setF] = useState({ days: 7, reason: "" });
  const go = useAction((v: any) => post(`/api/admin/tenants/${tenant.id}/extend-trial`, v), [["admin-tenants"]]);
  return (
    <Modal open onClose={onClose} title={`Prolongar demonstração · ${tenant.name}`}>
      <div className="space-y-3">{go.error && <ErrorText error={go.error} />}
        <Field label="Dias"><Input type="number" min={1} max={30} value={f.days} onChange={(e) => setF({ ...f, days: +e.target.value })} /></Field>
        <Field label="Motivo (auditado)"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <Button onClick={async () => { await go.mutateAsync(f); onClose(); }}><T>Confirmar</T></Button>
      </div>
    </Modal>
  );
}

export function AdminPlans() {
  const { data, isLoading, error } = useApi<any[]>(["admin-plans"], "/api/admin/plans");
  const [edit, setEdit] = useState<any | null>(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader title="Planos, limites e preços" subtitle="Configuração comercial sem alterar código. Cada alteração fica no histórico de auditoria. Valores vazios = a definir." />
      <Alert tone="warning"><T>PENDENTE: preços e limites atuais são valores de teste. Marque "confirmado" apenas após aprovação do proprietário do produto — só então são publicados no site.</T></Alert>
      <div className="mt-4 grid gap-4 md:grid-cols-3">{data!.map((p) => (
        <Card key={p.id} title={p.name} actions={<Button size="sm" variant="secondary" onClick={() => setEdit(p)}><T>Editar</T></Button>}>
          <ul className="space-y-1 text-sm">
            <li>Mensal: {fmtMoney(p.priceMonthly, p.currency)} · Anual: {fmtMoney(p.priceYearly, p.currency)}</li>
            <li>Funcionários: {p.maxEmployees ?? "—"} · Utilizadores: {p.maxUsers ?? "—"}</li>
            <li>Admins secundários: {p.maxSecondaryAdmins ?? "—"} · Módulos: {p.includedModules ?? "—"}</li>
            <li>Créditos IA/mês: {p.aiCreditsMonthly ?? "—"}</li>
            <li>Extra utilizador: {fmtMoney(p.extraUserPrice, p.currency)} · Extra módulo: {fmtMoney(p.extraModulePrice, p.currency)}</li>
            <li>{p.commercialConfirmed ? <Badge tone="green"><T>Confirmado</T></Badge> : <Badge tone="amber"><T>Por validar</T></Badge>} {!p.isActive && <Badge><T>Inativo</T></Badge>}</li>
          </ul>
        </Card>
      ))}</div>
      {edit && <PlanEditor plan={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function PlanEditor({ plan, onClose }: { plan: any; onClose: () => void }) {
  const [f, setF] = useState<any>(plan);
  const save = useAction((v: any) => put(`/api/admin/plans/${plan.id}`, v), [["admin-plans"]]);
  const num = (k: string, label: string) => <Field label={label}><Input type="number" min={0} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value === "" ? null : +e.target.value })} placeholder="a definir" /></Field>;
  return (
    <Modal open onClose={onClose} title={`Editar plano · ${plan.name}`} wide>
      <div className="space-y-3">{save.error && <ErrorText error={save.error} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Moeda"><Input maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></Field>
          {num("priceMonthly", "Preço mensal")}{num("priceYearly", "Preço anual")}{num("maxEmployees", "Máx. funcionários")}{num("maxUsers", "Máx. utilizadores")}
          {num("maxSecondaryAdmins", "Máx. admins secundários")}{num("includedModules", "Módulos incluídos")}{num("aiCreditsMonthly", "Créditos IA/mês")}
          {num("extraUserPrice", "Preço utilizador extra/mês")}{num("extraModulePrice", "Preço módulo extra/mês")}
        </div>
        <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.commercialConfirmed} onChange={(e) => setF({ ...f, commercialConfirmed: e.target.checked })} /><T>Valores confirmados pelo proprietário do produto (publicar no site)</T></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /><T>Plano ativo</T></label>
        <Button loading={save.isPending} onClick={async () => { const { name, description, priceMonthly, priceYearly, maxEmployees, maxUsers, maxSecondaryAdmins, includedModules, aiCreditsMonthly, extraUserPrice, extraModulePrice, commercialConfirmed, isActive, currency } = f; await save.mutateAsync({ name, description, priceMonthly, priceYearly, maxEmployees, maxUsers, maxSecondaryAdmins, includedModules, aiCreditsMonthly, extraUserPrice, extraModulePrice, commercialConfirmed, isActive, currency }); onClose(); }}><T>Guardar</T></Button>
      </div>
    </Modal>
  );
}

export function AdminModules() {
  const { data, isLoading, error } = useApi<any[]>(["admin-modules"], "/api/admin/modules");
  const [edit, setEdit] = useState<any | null>(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader title="Catálogo de módulos" subtitle="Preparado para os 18 módulos. Nomes oficiais aguardam validação; módulos não implementados não podem ser ativados." />
      <DataTable rows={data} rowKey={(r: any) => r.code} columns={[
        { key: "code", header: "Código", render: (r: any) => <span className="font-mono text-xs">{r.code}</span> },
        { key: "name", header: "Nome", render: (r: any) => <>{r.name} {r.provisional && <Badge tone="amber"><T>provisório</T></Badge>}</> },
        { key: "status", header: "Estado", render: (r: any) => <Badge tone={r.status === "active" ? "green" : "gray"}>{r.status}</Badge> },
        { key: "implemented", header: "Implementado", render: (r: any) => (r.implemented ? "Sim" : "Não") },
        { key: "dependsOn", header: "Dependências", render: (r: any) => r.dependsOn.join(", ") || "—" },
        { key: "priceMonthly", header: "Preço/mês", render: (r: any) => fmtMoney(r.priceMonthly) },
        { key: "a", header: "", render: (r: any) => <Button size="sm" variant="secondary" onClick={() => setEdit(r)}><T>Editar</T></Button> },
      ]} />
      {edit && <ModuleEditor mod={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ModuleEditor({ mod, onClose }: { mod: any; onClose: () => void }) {
  const [f, setF] = useState<any>({ ...mod, dependsOn: mod.dependsOn.join(", ") });
  const save = useAction((v: any) => put(`/api/admin/modules/${mod.code}`, v), [["admin-modules"]]);
  return (
    <Modal open onClose={onClose} title={`Módulo ${mod.code}`}>
      <div className="space-y-3">{save.error && <ErrorText error={save.error} />}
        <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Estado"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="active">Ativo (contratável)</option><option value="pending">Em definição</option><option value="inactive">Inativo</option></Select></Field>
        <Field label="Preço mensal (vazio = preço de módulo extra do plano)"><Input type="number" value={f.priceMonthly ?? ""} onChange={(e) => setF({ ...f, priceMonthly: e.target.value === "" ? null : +e.target.value })} /></Field>
        <Field label="Dependências (códigos separados por vírgula)"><Input value={f.dependsOn} onChange={(e) => setF({ ...f, dependsOn: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.provisional} onChange={(e) => setF({ ...f, provisional: e.target.checked })} /><T>Nome provisório</T></label>
        <Button onClick={async () => { await save.mutateAsync({ name: f.name, description: f.description, status: f.status, provisional: f.provisional, priceMonthly: f.priceMonthly, dependsOn: f.dependsOn.split(",").map((s: string) => s.trim()).filter(Boolean), minPlan: f.minPlan ?? null }); onClose(); }}><T>Guardar</T></Button>
      </div>
    </Modal>
  );
}

export function AdminPayments() {
  const { data, isLoading, error } = useApi<any[]>(["admin-payments"], "/api/admin/payments");
  const [rec, setRec] = useState<any | null>(null);
  return (
    <>
      <PageHeader title="Pagamentos e reconciliação" subtitle="Confirme manualmente transferências bancárias recebidas. A ativação da empresa é automática e idempotente." />
      <DataTable rows={data} loading={isLoading} error={error} columns={[
        { key: "createdAt", header: "Data", render: (r: any) => fmtDateTime(r.createdAt) },
        { key: "tenant", header: "Empresa" },
        { key: "invoice", header: "Fatura" },
        { key: "provider", header: "Meio" },
        { key: "providerRef", header: "Referência", render: (r: any) => <span className="font-mono text-xs">{r.providerRef}</span> },
        { key: "amount", header: "Valor", render: (r: any) => fmtMoney(r.amount) },
        { key: "status", header: "Estado", render: (r: any) => <Badge tone={r.status === "confirmed" ? "green" : r.status === "failed" ? "red" : "amber"}>{r.status}</Badge> },
        { key: "a", header: "", render: (r: any) => r.status === "pending" && <Button size="sm" onClick={() => setRec(r)}><T>Reconciliar</T></Button> },
      ]} />
      {rec && <Reconcile payment={rec} onClose={() => setRec(null)} />}
    </>
  );
}

function Reconcile({ payment, onClose }: { payment: any; onClose: () => void }) {
  const [f, setF] = useState({ amount: payment.amount, note: "" });
  const go = useAction((v: any) => post(`/api/admin/payments/${payment.id}/confirm`, v), [["admin-payments"], ["admin-tenants"]]);
  return (
    <Modal open onClose={onClose} title={`Reconciliar ${payment.providerRef}`}>
      <div className="space-y-3">{go.error && <ErrorText error={go.error} />}
        <Field label="Montante recebido"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
        <Field label="Nota (extrato, data-valor…)"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <Button onClick={async () => { await go.mutateAsync(f); onClose(); }}><T>Confirmar receção</T></Button>
      </div>
    </Modal>
  );
}

export function AdminSettings() {
  const { data, isLoading, error } = useApi<any[]>(["admin-settings"], "/api/admin/settings");
  const save = useAction(({ key, value }: any) => put(`/api/admin/settings/${key}`, { value }), [["admin-settings"]]);
  const run = useAction(() => post("/api/admin/jobs/run"));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setDrafts(Object.fromEntries(data.map((s) => [s.key, JSON.stringify(s.value, null, 2)]))); }, [data]);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <>
      <PageHeader title="Parâmetros globais" subtitle="Custos de IA, pacotes de créditos, retenção, impostos e fornecedores de pagamento." actions={<Button variant="secondary" loading={run.isPending} onClick={() => run.mutate(undefined)}><T>Executar jobs agora</T></Button>} />
      {run.data && <div className="mb-3"><Alert tone="success">Jobs executados: {JSON.stringify(run.data)}</Alert></div>}
      {save.error && <ErrorText error={save.error} />}
      <div className="grid gap-4 md:grid-cols-2">{data!.map((s) => (
        <Card key={s.key} title={s.key} actions={<Button size="sm" onClick={() => { try { save.mutate({ key: s.key, value: JSON.parse(drafts[s.key]) }); } catch { alert("JSON inválido"); } }}><T>Guardar</T></Button>}>
          <textarea className="input font-mono text-xs" rows={8} value={drafts[s.key] ?? ""} onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })} aria-label={s.key} />
        </Card>
      ))}</div>
    </>
  );
}

export function AdminSupport() {
  const { data, isLoading, error } = useApi<any[]>(["admin-grants"], "/api/admin/support/grants");
  const [view, setView] = useState<{ grant: any; dataset: string } | null>(null);
  const rows = useApi<any[]>(["admin-grant-data", view?.grant.id, view?.dataset], view ? `/api/admin/support/grants/${view.grant.id}/data/${view.dataset}` : null);
  return (
    <>
      <PageHeader title="Suporte técnico excecional" subtitle="Só pode consultar conteúdo de uma empresa com uma concessão ativa, dentro do âmbito e do prazo. Cada consulta é auditada e visível para a empresa." />
      {error ? <ErrorState error={error} /> : isLoading ? <Loading /> : !data?.length ? <Card><p className="text-sm muted"><T>Nenhuma concessão de acesso para a sua conta.</T></p></Card> : (
        <div className="space-y-2">{data.map((g) => (
          <div key={g.id} className="card p-4 text-sm">
            <p className="font-medium">{g.tenant} {g.active ? <Badge tone="green">Ativa até {fmtDateTime(g.endsAt)}</Badge> : <Badge><T>Inativa</T></Badge>}</p>
            <p className="muted">Motivo: {g.reason}</p>
            {g.active && <div className="mt-2 flex flex-wrap gap-2">{g.scope.map((s: string) => <Button key={s} size="sm" variant="secondary" onClick={() => setView({ grant: g, dataset: s })}>{s}</Button>)}</div>}
          </div>
        ))}</div>
      )}
      {view && (
        <Modal open onClose={() => setView(null)} title={`${view.grant.tenant} · ${view.dataset}`} wide>
          {rows.isLoading ? <Loading /> : rows.error ? <ErrorText error={rows.error} /> : <pre className="max-h-96 overflow-auto rounded bg-slate-100 p-3 text-xs dark:bg-slate-800">{JSON.stringify(rows.data, null, 2)}</pre>}
        </Modal>
      )}
    </>
  );
}

export function AdminAudit() {
  const { data, isLoading, error } = useApi<any[]>(["admin-audit"], "/api/admin/audit");
  return (
    <>
      <PageHeader title="Auditoria administrativa" subtitle="Ações da equipa Nexora." />
      <DataTable rows={data} loading={isLoading} error={error} columns={[
        { key: "createdAt", header: "Data", render: (r: any) => fmtDateTime(r.createdAt) },
        { key: "action", header: "Ação", render: (r: any) => <span className="font-mono text-xs">{r.action}</span> },
        { key: "summary", header: "Resumo" },
        { key: "tenantId", header: "Empresa", render: (r: any) => r.tenantId ? r.tenantId.slice(0, 8) : "plataforma" },
      ]} />
    </>
  );
}

export function Admin2fa() {
  const setup = useAction(() => post("/api/admin/2fa/setup"));
  const [code, setCode] = useState("");
  const enable = useAction((c: string) => post("/api/admin/2fa/enable", { code: c }), [["admin-me"]]);
  return (
    <Card title="Ativar 2FA na conta administrativa">
      {enable.isSuccess ? <Alert tone="success"><T>2FA ativado.</T></Alert> : !setup.data ? <Button onClick={() => setup.mutate(undefined)}><T>Gerar código QR</T></Button> : (
        <div className="space-y-2 text-sm"><img src={setup.data.qr} alt="QR 2FA" className="h-44 w-44 bg-white p-2" />{enable.error && <ErrorText error={enable.error} />}<div className="flex gap-2"><Input value={code} onChange={(e) => setCode(e.target.value)} className="w-32" aria-label="Código" /><Button onClick={() => enable.mutate(code)}><T>Ativar</T></Button></div></div>
      )}
    </Card>
  );
}

export function AdminRetention() {
  const { data, isLoading, error } = useApi<any[]>(["admin-retention"], "/api/admin/retention");
  const [purge, setPurge] = useState<any | null>(null);
  return (
    <>
      <PageHeader title="Retenção de dados" subtitle="Empresas com subscrição terminada. Após o prazo de retenção, os dados pessoais são anonimizados e os operacionais eliminados; registos financeiros, vendas, faturas e auditoria são conservados." />
      <DataTable rows={data} loading={isLoading} error={error} rowKey={(r: any) => r.tenantId} columns={[
        { key: "name", header: "Empresa" },
        { key: "status", header: "Estado", render: (r: any) => <Badge>{r.status}</Badge> },
        { key: "endedAt", header: "Terminou", render: (r: any) => fmtDate(r.endedAt) },
        { key: "dueAt", header: "Prazo de retenção", render: (r: any) => fmtDate(r.dueAt) },
        { key: "flags", header: "", render: (r: any) => r.purgedAt ? <Badge tone="green">Executada {fmtDate(r.purgedAt)}</Badge> : r.legalHold ? <Badge tone="red">Retenção legal</Badge> : r.due ? <Badge tone="amber">Prazo cumprido</Badge> : <Badge>A decorrer</Badge> },
        { key: "a", header: "", render: (r: any) => r.due && !r.purgedAt && !r.legalHold && <Button size="sm" variant="danger" onClick={() => setPurge(r)}>Executar retenção</Button> },
      ]} />
      {purge && <PurgeModal row={purge} onClose={() => setPurge(null)} />}
    </>
  );
}

function PurgeModal({ row, onClose }: { row: any; onClose: () => void }) {
  const [f, setF] = useState({ confirmName: "", reason: "" });
  const go = useAction((v: any) => post(`/api/admin/retention/${row.tenantId}/purge`, v), [["admin-retention"]]);
  return (
    <Modal open onClose={onClose} title={`Executar retenção · ${row.name}`}>
      <div className="space-y-3 text-sm">
        <Alert tone="error">Ação irreversível: dados pessoais anonimizados, produtos, stock, documentos, histórico de IA e notificações eliminados, contas desativadas. Registos financeiros, vendas, faturas e auditoria são conservados (obrigação legal).</Alert>
        {go.error && <ErrorText error={go.error} />}
        <Field label="Escreva o nome exato da empresa para confirmar"><Input value={f.confirmName} onChange={(e) => setF({ ...f, confirmName: e.target.value })} /></Field>
        <Field label="Motivo (auditado)"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="danger" disabled={f.confirmName !== row.name || f.reason.trim().length < 10} loading={go.isPending} onClick={async () => { await go.mutateAsync(f); onClose(); }}>Executar</Button></div>
      </div>
    </Modal>
  );
}

const INC_STATUS: Record<string, string> = { investigating: "Em investigação", identified: "Causa identificada", monitoring: "Em monitorização", resolved: "Resolvido" };

export function AdminIncidents() {
  const { data, isLoading, error } = useApi<any[]>(["admin-incidents"], "/api/admin/incidents");
  const tenants = useApi<any[]>(["admin-tenants"], "/api/admin/tenants");
  const [creating, setCreating] = useState(false);
  const [update, setUpdate] = useState<any | null>(null);
  return (
    <>
      <PageHeader title="Incidentes" subtitle="Registo e comunicação de incidentes operacionais. As empresas afetadas são notificadas e veem um aviso no painel." actions={<Button onClick={() => setCreating(true)}>Abrir incidente</Button>} />
      {error ? <ErrorState error={error} /> : isLoading ? <Loading /> : !data?.length ? <Card><p className="text-sm muted">Sem incidentes registados.</p></Card> : (
        <div className="space-y-3">{data.map((i) => (
          <div key={i.id} className="card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{i.title}</p><p className="text-xs muted">{fmtDateTime(i.createdAt)} · {i.allTenants ? "Todas as empresas" : `${i.affectedTenants.length} empresa(s)`}</p></div>
              <div className="flex gap-2"><Badge tone={i.severity === "critical" || i.severity === "high" ? "red" : "amber"}>{i.severity}</Badge><Badge tone={i.status === "resolved" ? "green" : "blue"}>{INC_STATUS[i.status]}</Badge></div>
            </div>
            <ol className="mt-3 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-700">
              {i.updates.map((u: any, k: number) => <li key={k}><span className="text-xs muted">{fmtDateTime(u.at)} · {u.by} · {INC_STATUS[u.status]}</span><br />{u.note}</li>)}
            </ol>
            {i.status !== "resolved" && <Button size="sm" variant="secondary" className="mt-3" onClick={() => setUpdate(i)}>Atualizar</Button>}
          </div>
        ))}</div>
      )}
      {creating && <IncidentForm tenants={tenants.data ?? []} onClose={() => setCreating(false)} />}
      {update && <IncidentUpdate incident={update} onClose={() => setUpdate(null)} />}
    </>
  );
}

function IncidentForm({ tenants, onClose }: { tenants: any[]; onClose: () => void }) {
  const [f, setF] = useState({ title: "", severity: "medium", description: "", allTenants: true, affectedTenants: [] as string[] });
  const go = useAction((v: any) => post("/api/admin/incidents", v), [["admin-incidents"]]);
  return (
    <Modal open onClose={onClose} title="Abrir incidente" wide>
      <div className="space-y-3 text-sm">
        {go.error && <ErrorText error={go.error} />}
        <Field label="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Gravidade"><Select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option></Select></Field>
        <Field label="Descrição (enviada às empresas afetadas)"><textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.allTenants} onChange={(e) => setF({ ...f, allTenants: e.target.checked })} />Afeta todas as empresas</label>
        {!f.allTenants && <div className="max-h-48 overflow-auto rounded border border-slate-200 p-2 dark:border-slate-700">{tenants.map((t) => <label key={t.id} className="flex items-center gap-2"><input type="checkbox" checked={f.affectedTenants.includes(t.id)} onChange={(e) => setF({ ...f, affectedTenants: e.target.checked ? [...f.affectedTenants, t.id] : f.affectedTenants.filter((x) => x !== t.id) })} />{t.name}</label>)}</div>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={f.title.trim().length < 5} loading={go.isPending} onClick={async () => { await go.mutateAsync(f); onClose(); }}>Abrir e notificar</Button></div>
      </div>
    </Modal>
  );
}

function IncidentUpdate({ incident, onClose }: { incident: any; onClose: () => void }) {
  const [f, setF] = useState({ status: incident.status, note: "" });
  const go = useAction((v: any) => post(`/api/admin/incidents/${incident.id}/updates`, v), [["admin-incidents"]]);
  return (
    <Modal open onClose={onClose} title={`Atualizar · ${incident.title}`}>
      <div className="space-y-3 text-sm">
        {go.error && <ErrorText error={go.error} />}
        <Field label="Estado"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(INC_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Nota (enviada às empresas afetadas)"><textarea className="input" rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={f.note.trim().length < 3} loading={go.isPending} onClick={async () => { await go.mutateAsync(f); onClose(); }}>Publicar atualização</Button></div>
      </div>
    </Modal>
  );
}
