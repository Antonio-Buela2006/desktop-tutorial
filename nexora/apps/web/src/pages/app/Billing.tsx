import { useEffect, useState } from "react";
import { T } from "../../lib/i18n";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { fmtDate, fmtMoney, fmtNum, newIdempotencyKey, post, useAction, useApi } from "../../lib/api";
import { Alert, Badge, Button, Card, DataTable, ErrorState, ErrorText, Field, Loading, Modal, PageHeader, Select, Input, useConfirm, useToast } from "../../components/ui";
import { can } from "../../layouts/AppLayout";
import { useMeCtx } from "./Business";

const stateLabel: Record<string, [string, "green" | "amber" | "red" | "blue" | "gray"]> = {
  trial: ["Demonstração", "blue"], trial_expired: ["Demonstração terminada", "red"], pending_payment: ["Aguarda pagamento", "amber"], active: ["Ativa", "green"],
  grace: ["Em tolerância", "amber"], read_only: ["Somente leitura", "red"], suspended: ["Suspensa", "red"], cancel_scheduled: ["Cancelamento agendado", "amber"], canceled: ["Cancelada", "gray"], expired: ["Expirada", "gray"],
};
const invStatus: Record<string, string> = { issued: "Emitida", paid: "Paga", partially_paid: "Parcialmente paga", void: "Anulada", refunded: "Reembolsada", draft: "Rascunho" };

export function Billing() {
  const me = useMeCtx();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useApi<any>(["billing"], "/api/billing/overview");
  const [payInv, setPayInv] = useState<any | null>(null);
  const [planModal, setPlanModal] = useState(false);
  const [modModal, setModModal] = useState(false);
  const [convert, setConvert] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const manage = can(me, "billing.manage");
  const cancel = useAction(() => post("/api/billing/cancel", { confirm: true }), [["billing"], ["me"]]);
  const resume = useAction(() => post("/api/billing/resume"), [["billing"], ["me"]]);
  const buyCredits = useAction((code: string) => post("/api/billing/ai-credits", { packCode: code, authorize: true }), [["billing"]]);
  const capacity = useAction((n: number) => post("/api/billing/capacity", { extraUsers: n }), [["billing"]]);
  const [extraUsers, setExtraUsers] = useState(1);

  useEffect(() => {
    const id = params.get("pay");
    if (id && data) setPayInv(data.invoices.find((i: any) => i.id === id) ?? null);
  }, [params, data]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const s = data.subscription;
  const [lbl, tone] = stateLabel[data.accessState] ?? [data.accessState, "gray"];
  const cur = data.plan.currency;
  const open = data.invoices.filter((i: any) => ["issued", "partially_paid"].includes(i.status));
  return (
    <>
      <PageHeader title="Subscrição e faturação" subtitle="Plano, módulos, capacidade, faturas e pagamentos." />
      {data.daysOverdue > 0 && <div className="mb-4"><Alert tone="error">Pagamento em atraso há {data.daysOverdue} dia(s). Regras: dias 1–3 acesso normal · 4–8 somente leitura · a partir do 9.º suspensão (dados preservados).</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Plano atual" actions={<Badge tone={tone}>{lbl}</Badge>}>
          <p className="text-2xl font-semibold">{data.plan.name}</p>
          <p className="text-sm muted">{fmtMoney(data.plan.priceMonthly, cur)} / mês {!data.plan.commercialConfirmed && <Badge tone="amber"><T>valor de teste</T></Badge>}</p>
          <dl className="mt-3 space-y-1 text-sm">
            {s.trialEndsAt && <div className="flex justify-between"><dt className="muted"><T>Demonstração até</T></dt><dd>{fmtDate(s.trialEndsAt)}</dd></div>}
            {s.currentPeriodEnd && <div className="flex justify-between"><dt className="muted"><T>Período atual até</T></dt><dd>{fmtDate(s.currentPeriodEnd)}</dd></div>}
            <div className="flex justify-between"><dt className="muted"><T>Periodicidade</T></dt><dd>{s.billingCycle === "yearly" ? "Anual" : "Mensal"}</dd></div>
            {s.moduleSwapWindowEndsAt && <div className="flex justify-between"><dt className="muted"><T>Troca gratuita de módulos</T></dt><dd>{data.freeSwapWindow ? `até ${fmtDate(s.moduleSwapWindowEndsAt)}` : "terminada"}</dd></div>}
          </dl>
          {manage && (
            <div className="mt-4 flex flex-wrap gap-2">
              {s.status === "trial" || data.accessState === "canceled" || data.accessState === "expired" ? <Button onClick={() => setConvert(true)}><T>Converter para plano pago</T></Button> : s.status === "active" && <Button variant="secondary" onClick={() => setPlanModal(true)}><T>Alterar plano</T></Button>}
              {s.status === "active" && !s.cancelAtPeriodEnd && <Button variant="ghost" onClick={async () => { if (await confirm("Cancelar subscrição", <>Mantém o acesso até <strong>{fmtDate(s.currentPeriodEnd)}</strong><T>. Depois, o acesso operacional é suspenso e pode exportar os seus dados durante o período de retenção.</T></>)) { await cancel.mutateAsync(undefined); toast("Cancelamento agendado."); } }}><T>Cancelar</T></Button>}
              {s.cancelAtPeriodEnd && data.accessState !== "canceled" && <Button variant="secondary" onClick={() => resume.mutate(undefined)}><T>Retomar subscrição</T></Button>}
            </div>
          )}
        </Card>
        <Card title="Capacidade">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="muted"><T>Funcionários</T></span><span>{data.usage.employees} / {data.limits.maxEmployees ?? "—"}</span></li>
            <li className="flex justify-between"><span className="muted"><T>Utilizadores</T></span><span>{data.usage.users} / {data.limits.maxUsers ?? "—"}</span></li>
            <li className="flex justify-between"><span className="muted"><T>Administradores secundários</T></span><span>{data.usage.secondaryAdmins} / {data.limits.maxSecondaryAdmins ?? "—"}</span></li>
            <li className="flex justify-between"><span className="muted"><T>Módulos (franquia)</T></span><span>{data.usage.modules} / {data.limits.includedModules ?? "—"}</span></li>
          </ul>
          {manage && s.status === "active" && (
            <div className="mt-4 flex items-end gap-2">
              <Field label="Utilizadores adicionais"><Input type="number" min={1} value={extraUsers} onChange={(e) => setExtraUsers(Math.max(1, +e.target.value))} className="w-24" /></Field>
              <Button variant="secondary" loading={capacity.isPending} onClick={async () => { const r = await capacity.mutateAsync(extraUsers); setPayInv(r.invoice); }}><T>Comprar</T></Button>
            </div>
          )}
          {capacity.error && <ErrorText error={capacity.error} />}
        </Card>
        <Card title="Créditos de IA">
          <p className="text-2xl font-semibold">{fmtNum(data.aiWallet?.balance)}</p>
          <p className="text-sm muted">Franquia mensal: {fmtNum(data.aiWallet?.monthlyAllowance)}</p>
          <p className="mt-2 text-xs muted"><T>Nunca cobramos créditos adicionais sem a sua autorização explícita.</T></p>
          {manage && s.status !== "trial" && (
            <div className="mt-3 space-y-2">
              {data.aiCreditPacks.map((p: any) => <Button key={p.code} variant="secondary" size="sm" className="w-full" onClick={async () => { if (await confirm("Comprar créditos", `Autoriza a compra de ${p.credits} créditos por ${fmtMoney(p.price, cur)}?`, false)) { const r = await buyCredits.mutateAsync(p.code); setPayInv(r.invoice); } }}>{fmtNum(p.credits)} créditos · {fmtMoney(p.price, cur)}</Button>)}
            </div>
          )}
        </Card>
      </div>

      <Card title="Módulos" className="mt-4" actions={manage && s.status !== "trial" && ["active", "grace", "cancel_scheduled"].includes(data.accessState) && <Button size="sm" variant="secondary" onClick={() => setModModal(true)}><T>Alterar módulos</T></Button>}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.modules.map((m: any) => (
            <div key={m.code} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <div><p className="font-medium">{m.name}</p>{m.dependsOn.length > 0 && <p className="text-xs muted">Requer: {m.dependsOn.join(", ")}</p>}</div>
              {m.tenantStatus === "active" ? <Badge tone="green"><T>Ativo</T></Badge> : m.tenantStatus === "inactive" ? <Badge><T>Inativo (dados preservados)</T></Badge> : m.status === "active" ? <Badge tone="blue"><T>Disponível</T></Badge> : <Badge><T>Em definição</T></Badge>}
            </div>
          ))}
        </div>
      </Card>

      <h2 className="mb-2 mt-6 font-semibold"><T>Faturas</T></h2>
      {open.length > 0 && <div className="mb-2"><Alert tone="warning">{open.length} fatura(s) por pagar.</Alert></div>}
      <DataTable rows={data.invoices} columns={[
        { key: "number", header: "N.º", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
        { key: "issuedAt", header: "Emissão", render: (r: any) => fmtDate(r.issuedAt) },
        { key: "dueAt", header: "Vencimento", render: (r: any) => fmtDate(r.dueAt) },
        { key: "lines", header: "Descrição", render: (r: any) => r.lines.map((l: any) => l.description).join("; ") },
        { key: "total", header: "Total", render: (r: any) => fmtMoney(r.total, r.currency) },
        { key: "status", header: "Estado", render: (r: any) => <Badge tone={r.status === "paid" ? "green" : r.overdue ? "red" : "amber"}>{r.overdue ? "Vencida" : invStatus[r.status] ?? r.status}</Badge> },
        { key: "a", header: "", className: "text-right", render: (r: any) => (
          <div className="flex justify-end gap-2">
            <a className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href={`/api/billing/invoices/${r.id}/pdf`}><T>PDF</T></a>
            {["issued", "partially_paid"].includes(r.status) && manage && <Button size="sm" onClick={() => setPayInv(r)}><T>Pagar</T></Button>}
          </div>
        ) },
      ]} />
      {payInv && <PayModal invoice={payInv} providers={data.providers} onClose={() => { setPayInv(null); nav("/app/billing", { replace: true }); }} />}
      {planModal && <PlanModal current={data.plan} plans={data.plans} onClose={() => setPlanModal(false)} onDone={(inv) => { setPlanModal(false); qc.invalidateQueries(); if (inv) setPayInv(inv); toast("Plano alterado."); }} />}
      {modModal && <ModulesModal data={data} onClose={() => setModModal(false)} onDone={(inv) => { setModModal(false); qc.invalidateQueries(); if (inv) setPayInv(inv); toast("Módulos atualizados."); }} />}
      {convert && <ConvertModal data={data} onClose={() => setConvert(false)} onDone={(inv) => { setConvert(false); qc.invalidateQueries(); setPayInv(inv); }} />}
      {dialog}{toastEl}
    </>
  );
}

function PayModal({ invoice, providers, onClose }: { invoice: any; providers: Record<string, boolean>; onClose: () => void }) {
  const nav = useNavigate();
  const [provider, setProvider] = useState(providers.sandbox ? "sandbox" : "bank_transfer");
  const [key] = useState(newIdempotencyKey);
  const pay = useAction((v: any) => post(`/api/billing/invoices/${invoice.id}/pay`, v));
  const res = pay.data;
  return (
    <Modal open onClose={onClose} title={`Pagar fatura ${invoice.number}`}>
      <div className="space-y-3 text-sm">
        <p className="text-2xl font-semibold">{fmtMoney(invoice.total - (invoice.amountPaid ?? 0), invoice.currency)}</p>
        {pay.error && <ErrorText error={pay.error} />}
        {!res ? (
          <>
            <Field label="Meio de pagamento">
              <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="sandbox" disabled={!providers.sandbox}>Cartão / gateway (sandbox de teste)</option>
                <option value="bank_transfer" disabled={!providers.bank_transfer}>Transferência bancária</option>
                <option value="multicaixa_express" disabled={!providers.multicaixa_express}>Multicaixa Express {providers.multicaixa_express ? "" : "(em breve)"}</option>
              </Select>
            </Field>
            <Button loading={pay.isPending} onClick={async () => { const r = await pay.mutateAsync({ provider, idempotencyKey: key }); if (r.checkoutUrl) nav(r.checkoutUrl); }}><T>Continuar</T></Button>
          </>
        ) : (
          <>
            <Alert><T>Referência:</T> <strong>{res.reference}</strong></Alert>
            <p className="muted">{res.instructions}</p>
            <div className="flex justify-end"><Button onClick={onClose}><T>Fechar</T></Button></div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PlanModal({ current, plans, onClose, onDone }: { current: any; plans: any[]; onClose: () => void; onDone: (inv: any) => void }) {
  const [code, setCode] = useState(plans.find((p) => p.code !== current.code)?.code ?? "");
  const preview = useAction((c: string) => post("/api/billing/plan/preview", { planCode: c }));
  const apply = useAction((c: string) => post("/api/billing/plan/change", { planCode: c, confirm: true }));
  useEffect(() => { if (code) preview.mutate(code); }, [code]); // eslint-disable-line
  const p = preview.data;
  return (
    <Modal open onClose={onClose} title="Alterar plano">
      <div className="space-y-3 text-sm">
        <Field label="Novo plano"><Select value={code} onChange={(e) => setCode(e.target.value)}>{plans.filter((x) => x.code !== current.code).map((x) => <option key={x.code} value={x.code}>{x.name} · {fmtMoney(x.priceMonthly, x.currency)}/mês</option>)}</Select></Field>
        {preview.error && <ErrorText error={preview.error} />}
        {p && (
          <>
            <p><Badge tone={p.direction === "upgrade" ? "green" : "amber"}>{p.direction === "upgrade" ? "Upgrade" : "Downgrade"}</Badge> <T>Ajuste proporcional:</T> <strong>{fmtMoney(p.prorated, p.target.currency)}</strong> {p.prorated < 0 && "(crédito)"}</p>
            <p className="muted">Novos limites: {p.limits.maxEmployees ?? "—"} funcionários · {p.limits.maxUsers ?? "—"} utilizadores · {p.limits.includedModules ?? "—"} módulos</p>
            {p.violations.length > 0 && <Alert tone="warning"><ul className="list-disc pl-4">{p.violations.map((v: string) => <li key={v}>{v}</li>)}</ul><p className="mt-1">{p.policy}</p></Alert>}
          </>
        )}
        {apply.error && <ErrorText error={apply.error} />}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button disabled={!p} loading={apply.isPending} onClick={async () => { const r = await apply.mutateAsync(code); onDone(r.invoice?.status === "issued" ? r.invoice : null); }}><T>Confirmar alteração</T></Button></div>
      </div>
    </Modal>
  );
}

function ModulesModal({ data, onClose, onDone }: { data: any; onClose: () => void; onDone: (inv: any) => void }) {
  const active = data.modules.filter((m: any) => m.tenantStatus === "active").map((m: any) => m.code);
  const [sel, setSel] = useState<string[]>(active);
  const add = sel.filter((c) => !active.includes(c));
  const remove = active.filter((c: string) => !sel.includes(c));
  const preview = useAction((v: any) => post("/api/billing/modules/preview", v));
  const apply = useAction((v: any) => post("/api/billing/modules/apply", { ...v, confirm: true }));
  useEffect(() => { if (add.length || remove.length) preview.mutate({ add, remove }); }, [sel.join()]); // eslint-disable-line
  const p = preview.data;
  return (
    <Modal open onClose={onClose} title="Alterar módulos" wide>
      <div className="space-y-3 text-sm">
        <Alert>{data.freeSwapWindow ? "Está na janela inicial de 7 dias: trocas sem custo." : "Fora da janela inicial: aplica-se cobrança ou crédito proporcional."} Desativar um módulo bloqueia o acesso mas nunca apaga os dados.</Alert>
        <div className="grid gap-2 sm:grid-cols-2">
          {data.modules.filter((m: any) => m.status === "active").map((m: any) => (
            <label key={m.code} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800"><input type="checkbox" checked={sel.includes(m.code)} onChange={(e) => setSel(e.target.checked ? [...sel, m.code] : sel.filter((x) => x !== m.code))} />{m.name}</label>
          ))}
        </div>
        {p?.problems?.length > 0 && <Alert tone="warning"><ul className="list-disc pl-4">{p.problems.map((x: string) => <li key={x}>{x}</li>)}</ul></Alert>}
        {p && !p.problems.length && <p><T>Diferença mensal:</T> <strong>{fmtMoney(p.monthlyDelta, data.plan.currency)}</strong> <T>· A pagar agora:</T> <strong>{fmtMoney(p.prorated, data.plan.currency)}</strong>{p.freeSwap && " (troca gratuita)"}</p>}
        {apply.error && <ErrorText error={apply.error} />}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button disabled={!p || p.problems.length > 0 || (!add.length && !remove.length)} loading={apply.isPending} onClick={async () => { const r = await apply.mutateAsync({ add, remove }); onDone(r.invoice?.status === "issued" ? r.invoice : null); }}><T>Aplicar</T></Button></div>
      </div>
    </Modal>
  );
}

function ConvertModal({ data, onClose, onDone }: { data: any; onClose: () => void; onDone: (inv: any) => void }) {
  const [f, setF] = useState({ planCode: data.plan.code, modules: ["crm", "inventory"], billingCycle: "monthly", extraUsers: 0, purgeDemoData: true });
  const go = useAction((v: any) => post("/api/billing/convert", v));
  const catalog = data.modules.filter((m: any) => m.status === "active");
  return (
    <Modal open onClose={onClose} title="Converter para plano pago" wide>
      <div className="space-y-3 text-sm">
        {go.error && <ErrorText error={go.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plano"><Select value={f.planCode} onChange={(e) => setF({ ...f, planCode: e.target.value })}>{data.plans.map((p: any) => <option key={p.code} value={p.code}>{p.name} · {fmtMoney(p.priceMonthly, p.currency)}/mês</option>)}</Select></Field>
          <Field label="Periodicidade"><Select value={f.billingCycle} onChange={(e) => setF({ ...f, billingCycle: e.target.value })}><option value="monthly">Mensal</option><option value="yearly">Anual</option></Select></Field>
        </div>
        <fieldset><legend className="label"><T>Módulos</T></legend><div className="grid gap-2 sm:grid-cols-2">{catalog.map((m: any) => <label key={m.code} className="flex items-center gap-2"><input type="checkbox" checked={f.modules.includes(m.code)} onChange={(e) => setF({ ...f, modules: e.target.checked ? [...f.modules, m.code, ...m.dependsOn.filter((d: string) => !f.modules.includes(d))] : f.modules.filter((x) => x !== m.code) })} />{m.name}</label>)}</div></fieldset>
        <label className="flex items-start gap-2"><input type="checkbox" checked={f.purgeDemoData} onChange={(e) => setF({ ...f, purgeDemoData: e.target.checked })} className="mt-0.5" /><span><T>Começar com dados limpos (remover os dados fictícios da demonstração após o pagamento). Recomendado para separar dados de demonstração e dados reais.</T></span></label>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button loading={go.isPending} onClick={async () => onDone((await go.mutateAsync(f)).invoice)}><T>Emitir fatura e pagar</T></Button></div>
      </div>
    </Modal>
  );
}
