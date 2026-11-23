import { useEffect, useRef, useState } from "react";
import { T } from "../../lib/i18n";
import { useSearchParams } from "react-router-dom";
import { Bot, Check, Mic, MicOff, Send, Volume2, X } from "lucide-react";
import { fmtDateTime, fmtNum, post, put, useAction, useApi } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Alert, Badge, Button, Card, ErrorState, ErrorText, Field, Loading, PageHeader, Select, cx } from "../../components/ui";
import { can } from "../../layouts/AppLayout";
import { useMeCtx } from "./Business";

type Msg = { role: "user" | "ai"; text: string; meta?: any };

/** Voz via Web Speech API quando suportada; alternativa textual sempre disponível. */
function useSpeech(lang: string, onText: (t: string) => void) {
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const start = () => {
    if (!SR) return;
    const r = new SR();
    r.lang = lang === "en" ? "en-US" : "pt-PT";
    r.interimResults = false;
    r.onresult = (e: any) => onText(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  const stop = () => rec.current?.stop();
  const speak = (t: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = lang === "en" ? "en-US" : "pt-PT";
    speechSynthesis.speak(u);
  };
  return { supported: !!SR, listening, start, stop, speak, canSpeak: "speechSynthesis" in window };
}

export function AIPage() {
  const me = useMeCtx();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "chat";
  const tabs = [["chat", "Assistente"], ["approvals", "Aprovações"], ["usage", "Créditos e consumo"], ...(can(me, "ai.configure") ? [["policy", "Políticas de IA"]] : [])];
  return (
    <>
      <PageHeader title="Assistente IA" subtitle="A IA herda as suas permissões e as políticas da empresa. Ações sensíveis exigem aprovação humana." />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })} className={cx("whitespace-nowrap border-b-2 px-3 py-2 text-sm", tab === k ? "border-brand-600 font-medium text-brand-700 dark:text-brand-100" : "border-transparent muted")}><T>{l}</T></button>)}
      </div>
      {tab === "chat" && <Chat />}
      {tab === "approvals" && <Approvals />}
      {tab === "usage" && <Usage />}
      {tab === "policy" && <Policy />}
    </>
  );
}

function Chat() {
  const { lang, tr } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const send = useAction((m: string) => post("/api/ai/chat", { message: m, locale: lang }), [["ai-actions"], ["ai-usage"]]);
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech(lang, (t) => setText(t));
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);
  const submit = async (m = text) => {
    if (!m.trim()) return;
    setMsgs((x) => [...x, { role: "user", text: m }]);
    setText("");
    try {
      const r = await send.mutateAsync(m);
      setMsgs((x) => [...x, { role: "ai", text: r.answer, meta: r }]);
    } catch (e: any) {
      setMsgs((x) => [...x, { role: "ai", text: e.message, meta: { error: true } }]);
    }
  };
  const suggestions = lang === "en"
    ? ["Business overview", "Which products are low on stock?", "Forecast sales", "Simulate a 10% price increase"]
    : ["Resumo do negócio", "Que produtos têm stock baixo?", "Previsão de vendas", "Simular aumento de preço de 10%", "Ajustar stock do SKU-002: acrescentar 20 unidades"];
  return (
    <div className="card flex h-[calc(100vh-15rem)] min-h-[420px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!msgs.length && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Bot className="h-10 w-10 text-brand-600" />
            <p className="max-w-md text-sm muted"><T>Pergunte sobre os seus dados autorizados, peça previsões ou simulações, ou proponha ações. Os conteúdos dos registos são tratados como dados, nunca como instruções.</T></p>
            <div className="flex flex-wrap justify-center gap-2">{suggestions.map((s) => <button key={s} onClick={() => submit(s)} className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm", m.role === "user" ? "bg-brand-600 text-white" : m.meta?.error ? "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100" : "bg-slate-100 dark:bg-slate-800")}>
              {m.text}
              {m.meta?.pendingActions?.length > 0 && <p className="mt-2"><Badge tone="amber">{m.meta.pendingActions.length} ação(ões) a aguardar aprovação</Badge></p>}
              {m.meta?.toolCalls && (
                <p className="mt-2 text-[11px] opacity-70">
                  {m.meta.provider} · {m.meta.creditsUsed} crédito(s){m.meta.toolCalls.length ? ` · ferramentas: ${m.meta.toolCalls.map((t: any) => t.tool).join(", ")}` : ""}
                  {speech.canSpeak && <button className="ml-2 align-middle" onClick={() => speech.speak(m.text)} aria-label="Ler em voz alta"><Volume2 className="inline h-3 w-3" /></button>}
                </p>
              )}
            </div>
          </div>
        ))}
        {send.isPending && <Loading label="A pensar…" />}
        <div ref={endRef} />
      </div>
      <form className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {speech.supported && <Button type="button" variant="secondary" onClick={speech.listening ? speech.stop : speech.start} aria-label={speech.listening ? "Parar ditado" : "Ditar por voz"}>{speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button>}
        <input className="input" placeholder={tr("Escreva a sua pergunta…")} aria-label={tr("Mensagem para a IA")} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
        <Button loading={send.isPending} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function Approvals() {
  const [status, setStatus] = useState("pending");
  const { data, isLoading, error } = useApi<any[]>(["ai-actions", status], `/api/ai/actions?status=${status}`);
  const decide = useAction(({ id, decision }: any) => post(`/api/ai/actions/${id}/decision`, { decision }), [["ai-actions"], ["dashboard"]]);
  const cancel = useAction((id: string) => post(`/api/ai/actions/${id}/cancel`), [["ai-actions"]]);
  const me = useMeCtx();
  return (
    <>
      <div className="mb-3 flex justify-end"><Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44" aria-label="Estado"><option value="pending">Pendentes</option><option value="executed">Executadas</option><option value="rejected">Rejeitadas</option><option value="failed">Falhadas</option><option value="all">Todas</option></Select></div>
      {decide.error && <div className="mb-3"><ErrorText error={decide.error} /></div>}
      {error ? <ErrorState error={error} /> : isLoading ? <Loading /> : !data?.length ? <Card><p className="text-sm muted"><T>Sem ações neste estado.</T></p></Card> : (
        <div className="space-y-3">{data.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{String(a.preview.acao ?? a.tool)} <Badge tone={a.sensitivity === "sensitive" ? "red" : "blue"}>{a.sensitivity === "sensitive" ? "Sensível" : "Simples"}</Badge></p>
                <p className="text-xs muted">Pedido por {a.requester} · {fmtDateTime(a.createdAt)} · aprovações {a.approvals.length}/{a.requiredApprovals}</p>
              </div>
              <Badge tone={a.status === "executed" ? "green" : a.status === "pending" ? "amber" : "gray"}>{a.status}</Badge>
            </div>
            <dl className="mt-3 grid gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2 dark:bg-slate-800/50">
              {Object.entries(a.preview).filter(([k]) => k !== "acao").map(([k, v]) => <div key={k} className="flex gap-2"><dt className="muted">{k}:</dt><dd className="break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></div>)}
            </dl>
            {a.status === "pending" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {a.canDecide && <><Button size="sm" onClick={() => decide.mutate({ id: a.id, decision: "approve" })}><Check className="h-4 w-4" /><T>Aprovar e executar</T></Button><Button size="sm" variant="secondary" onClick={() => decide.mutate({ id: a.id, decision: "reject" })}><X className="h-4 w-4" /><T>Rejeitar</T></Button></>}
                {!a.canDecide && a.requestedBy === me.membership.id && <Button size="sm" variant="ghost" onClick={() => cancel.mutate(a.id)}><T>Cancelar pedido</T></Button>}
                {!a.canDecide && can(me, "ai.approve") && <p className="text-xs muted"><T>Segregação de funções: outra pessoa tem de aprovar.</T></p>}
              </div>
            )}
          </div>
        ))}</div>
      )}
    </>
  );
}

function Usage() {
  const { data, isLoading, error } = useApi<any>(["ai-usage"], "/api/ai/usage");
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Saldo">
        <p className="text-3xl font-semibold">{fmtNum(data.wallet.balance)}</p>
        <p className="text-sm muted">Franquia mensal {fmtNum(data.wallet.monthlyAllowance)} · consumo 30 dias: {fmtNum(data.consumedLast30Days)}</p>
        <p className="mt-2 text-sm">{data.depletionForecastDays !== null ? `Previsão de esgotamento: ~${data.depletionForecastDays} dias ao ritmo atual.` : "Consumo insuficiente para prever esgotamento."}</p>
        {data.wallet.balance <= 0 && <div className="mt-2"><Alert tone="warning"><T>Créditos esgotados: a IA está bloqueada; os restantes módulos funcionam normalmente.</T></Alert></div>}
      </Card>
      <Card title="Por operação"><ul className="space-y-1 text-sm">{data.byOperation.map((o: any) => <li key={o.operation} className="flex justify-between"><span>{o.operation}</span><span>{o.credits}</span></li>)}</ul></Card>
      <Card title="Ferramentas disponíveis para si">
        <ul className="space-y-1 text-sm">{data.tools.map((t: any) => <li key={t.name}><Badge tone={t.sensitivity === "read" ? "gray" : t.sensitivity === "sensitive" ? "red" : "blue"}>{t.sensitivity}</Badge> {t.name}</li>)}</ul>
        {!data.tools.length && <p className="text-sm muted"><T>Nenhuma (política ou permissões).</T></p>}
      </Card>
      {data.byUser.length > 0 && <Card title="Por utilizador (30 dias)"><ul className="space-y-1 text-sm">{data.byUser.map((u: any) => <li key={u.name} className="flex justify-between"><span>{u.name}</span><span>{u.credits}</span></li>)}</ul></Card>}
    </div>
  );
}

function Policy() {
  const me = useMeCtx();
  const { data, isLoading, error } = useApi<any>(["ai-policy"], "/api/ai/policy");
  const users = useApi<any>(["users"], "/api/company/users");
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (data && !f) setF(data); }, [data, f]);
  const save = useAction((v: any) => put("/api/ai/policy", v), [["ai-policy"], ["ai-usage"]]);
  if (isLoading || !f) return error ? <ErrorState error={error} /> : <Loading />;
  const mods = ["crm", "inventory", "sales", "finance"].filter((m) => me.modules.includes(m));
  const toggle = (k: string, m: string) => setF({ ...f, [k]: f[k].includes(m) ? f[k].filter((x: string) => x !== m) : [...f[k], m] });
  return (
    <Card title="Painel central de IA">
      <div className="space-y-4 text-sm">
        {save.error && <ErrorText error={save.error} />}
        {save.isSuccess && <Alert tone="success"><T>Política guardada e auditada.</T></Alert>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /><T>IA ativa na empresa</T></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Acesso aos dados" hint="Mesmo em acesso geral, a IA nunca revela dados a quem não tem permissão."><Select value={f.accessLevel} onChange={(e) => setF({ ...f, accessLevel: e.target.value })}><option value="restricted">Restrito (sem dados dos módulos)</option><option value="custom">Personalizado por módulo</option><option value="general">Geral (dados da própria empresa)</option></Select></Field>
          <Field label="Autonomia"><Select value={f.autonomy} onChange={(e) => setF({ ...f, autonomy: e.target.value })}><option value="suggest_only">Só sugerir (toda a escrita requer aprovação)</option><option value="simple_auto">Executar tarefas simples e reversíveis</option></Select></Field>
        </div>
        {f.accessLevel === "custom" && <fieldset><legend className="label"><T>Módulos acessíveis à IA</T></legend><div className="flex flex-wrap gap-3">{mods.map((m) => <label key={m} className="flex items-center gap-1"><input type="checkbox" checked={f.allowedModules.includes(m)} onChange={() => toggle("allowedModules", m)} />{m}</label>)}</div></fieldset>}
        <fieldset><legend className="label"><T>Desativar IA nos módulos</T></legend><div className="flex flex-wrap gap-3">{mods.map((m) => <label key={m} className="flex items-center gap-1"><input type="checkbox" checked={f.disabledModules.includes(m)} onChange={() => toggle("disabledModules", m)} />{m}</label>)}</div></fieldset>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.dualApprovalFinancial} onChange={(e) => setF({ ...f, dualApprovalFinancial: e.target.checked })} /><T>Dupla aprovação para movimentos financeiros</T></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.alertsEnabled} onChange={(e) => setF({ ...f, alertsEnabled: e.target.checked })} /><T>Alertas inteligentes (stock baixo, despesas anormais…)</T></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.learningEnabled} onChange={(e) => setF({ ...f, learningEnabled: e.target.checked })} /><T>Aprendizagem contextual com o histórico da empresa (isolada por empresa)</T></label>
        <fieldset><legend className="label"><T>Idiomas</T></legend><div className="flex gap-3">{["pt", "en"].map((l) => <label key={l} className="flex items-center gap-1"><input type="checkbox" checked={f.languages.includes(l)} onChange={() => toggle("languages", l)} />{l.toUpperCase()}</label>)}</div></fieldset>
        {me.membership.level === "primary_admin" && (
          <fieldset><legend className="label"><T>Delegar configuração a administradores secundários</T></legend><div className="flex flex-wrap gap-3">{users.data?.users.filter((u: any) => u.level === "secondary_admin").map((u: any) => <label key={u.id} className="flex items-center gap-1"><input type="checkbox" checked={f.delegatedTo.includes(u.id)} onChange={() => toggle("delegatedTo", u.id)} />{u.user.name}</label>)}</div></fieldset>
        )}
        <Button loading={save.isPending} onClick={() => { const { tenantId: _t, updatedAt: _u, ...rest } = f; save.mutate(rest); }}><T>Guardar política</T></Button>
      </div>
    </Card>
  );
}
