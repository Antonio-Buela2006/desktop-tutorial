import { useI18n } from "../../lib/i18n";
import { useState } from "react";
import { T } from "../../lib/i18n";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Download, RotateCcw, LogOut } from "lucide-react";
import { api, del, fmtDateTime, post, put, useAction, useApi } from "../../lib/api";
import { Alert, Badge, Button, Card, DataTable, ErrorState, ErrorText, Field, Input, Loading, PageHeader, Select, useToast } from "../../components/ui";
import { can } from "../../layouts/AppLayout";
import { useList, useMeCtx } from "./Business";

/* ============================== Auditoria ============================== */
export function Audit() {
  const { lang } = useI18n();
  const [actor, setActor] = useState("");
  const list = useList("audit", "/api/audit", actor ? { actorType: actor } : {});
  const verify = useApi<any>(["audit-verify"], "/api/audit/verify");
  return (
    <>
      <PageHeader title="Auditoria" subtitle="Registo de ações relevantes (utilizadores, sistema, IA e suporte Nexora), encadeado por hash." actions={verify.data && (verify.data.intact ? <Badge tone="green"><ShieldCheck className="mr-1 h-3 w-3" /><T>Cadeia íntegra</T></Badge> : <Badge tone="red"><ShieldAlert className="mr-1 h-3 w-3" />Inconsistência no registo #{verify.data.firstInconsistentId}</Badge>)} />
      <DataTable rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<Select aria-label="Origem" value={actor} onChange={(e) => setActor(e.target.value)} className="w-44"><option value="">Todas as origens</option><option value="user">Utilizadores</option><option value="ai">IA</option><option value="system">Sistema</option><option value="platform_admin">Suporte Nexora</option></Select>}
        columns={[
          { key: "createdAt", header: "Data", render: (r: any) => fmtDateTime(r.createdAt) },
          { key: "actorType", header: "Origem", render: (r: any) => <Badge tone={r.actorType === "ai" ? "blue" : r.actorType === "platform_admin" ? "amber" : "gray"}>{{ user: "Utilizador", ai: "IA", system: "Sistema", platform_admin: "Nexora" }[r.actorType as string]}</Badge> },
          { key: "action", header: "Ação", render: (r: any) => <span className="font-mono text-xs">{r.action}</span> },
          // Em inglês mostra a descrição traduzida da ação; o resumo original (imutável, em português) fica no título.
          { key: "summary", header: "Resumo", render: (r: any) => (lang === "en" && r.label ? <span title={r.summary}>{r.label}</span> : r.summary) },
          { key: "ip", header: "IP", render: (r: any) => r.ip ?? "—" },
        ]} />
    </>
  );
}

/* ============================== Exportação ============================== */
export function Exports() {
  const me = useMeCtx();
  const [scope, setScope] = useState("all");
  const [format, setFormat] = useState("xlsx");
  const run = useAction((v: any) => post("/api/exports", v));
  const options = [["all", "Todos os dados que posso exportar"], ["core", "Funcionários"], ...[["crm", "Clientes"], ["inventory", "Stock"], ["sales", "Vendas"], ["finance", "Finanças"]].filter(([m]) => me.modules.includes(m))];
  return (
    <>
      <PageHeader title="Exportar dados" subtitle="Formatos abertos. A exportação respeita as suas permissões e fica registada na auditoria." />
      <Card>
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Field label="Âmbito"><Select value={scope} onChange={(e) => setScope(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Formato" hint="CSV aplica-se a um conjunto; XLSX cria uma folha por conjunto."><Select value={format} onChange={(e) => setFormat(e.target.value)}><option value="xlsx">Excel (XLSX)</option><option value="pdf">Relatório PDF</option><option value="json">JSON (pacote estruturado)</option><option value="csv">CSV</option></Select></Field>
        </div>
        <Button className="mt-4" loading={run.isPending} onClick={() => run.mutate({ scope, format })}><T>Gerar exportação</T></Button>
        {run.error && <div className="mt-3"><ErrorText error={run.error} /></div>}
        {run.data && (
          <div className="mt-4"><Alert tone="success">Exportação pronta ({run.data.datasets.join(", ")}). Link temporário válido {run.data.expiresInMinutes} min: <a className="inline-flex items-center gap-1 font-semibold underline" href={run.data.downloadUrl}><Download className="h-4 w-4" /><T>Descarregar</T></a></Alert></div>
        )}
      </Card>
    </>
  );
}

/* ============================== Lixeira ============================== */
export function Trash() {
  const { data, isLoading, error } = useApi<any[]>(["trash"], "/api/trash");
  const qc = useQueryClient();
  const { toast, toastEl } = useToast();
  const restore = useAction(({ type, id }: any) => post(`/api/trash/${type}/${id}/restore`), [["trash"]]);
  const label: Record<string, string> = { customers: "Cliente", products: "Produto", employees: "Funcionário", finance_transactions: "Movimento financeiro" };
  return (
    <>
      <PageHeader title="Lixeira" subtitle="Registos eliminados ficam recuperáveis durante o prazo configurado. Registos financeiros com obrigação legal não são eliminados definitivamente antes do prazo aplicável." />
      {error ? <ErrorState error={error} /> : isLoading ? <Loading /> : (
        <DataTable rows={data} rowKey={(r: any) => r.type + r.id} columns={[
          { key: "type", header: "Tipo", render: (r: any) => label[r.type] },
          { key: "label", header: "Registo" },
          { key: "deletedAt", header: "Eliminado", render: (r: any) => fmtDateTime(r.deletedAt) },
          { key: "purgeAt", header: "Eliminação definitiva", render: (r: any) => (r.type === "finance_transactions" ? "Retenção legal" : fmtDateTime(r.purgeAt)) },
          { key: "a", header: "", className: "text-right", render: (r: any) => <Button size="sm" variant="secondary" onClick={async () => { await restore.mutateAsync(r); qc.invalidateQueries(); toast("Registo restaurado."); }}><RotateCcw className="h-4 w-4" /> <T>Restaurar</T></Button> },
        ]} />
      )}
      {toastEl}
    </>
  );
}

/* ============================== Notificações ============================== */
export function Notifications() {
  const { data, isLoading } = useApi<any>(["notifications"], "/api/notifications");
  const read = useAction(() => post("/api/notifications/read", {}), [["notifications"]]);
  const tone: Record<string, "red" | "amber" | "blue"> = { critical: "red", warning: "amber", info: "blue" };
  return (
    <>
      <PageHeader title="Notificações" subtitle="Alertas do sistema e da IA." actions={!!data?.unread && <Button variant="secondary" onClick={() => read.mutate(undefined)}><T>Marcar todas como lidas</T></Button>} />
      <NotificationPrefs />
      {isLoading ? <Loading /> : !data.items.length ? <Card><p className="text-sm muted"><T>Sem notificações.</T></p></Card> : (
        <ul className="space-y-2">{data.items.map((n: any) => (
          <li key={n.id} className={`card p-3 ${n.readAt ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-2"><p className="font-medium">{n.title}</p><Badge tone={tone[n.severity]}>{n.severity}</Badge></div>
            {n.body && <p className="mt-1 text-sm muted">{n.body}</p>}
            <p className="mt-1 text-xs muted">{fmtDateTime(n.createdAt)} {n.link && <a href={n.link} className="ml-2 underline"><T>Abrir</T></a>}</p>
          </li>
        ))}</ul>
      )}
    </>
  );
}

function NotificationPrefs() {
  const { data } = useApi<any>(["notif-prefs"], "/api/notifications/preferences");
  const [f, setF] = useState<any>(null);
  const save = useAction((v: any) => put("/api/notifications/preferences", v), [["notif-prefs"]]);
  if (data && !f) setF(data.preferences);
  if (!data || !f) return null;
  const quiet = f.quietStartHour !== null;
  return (
    <details className="card mb-4 p-4">
      <summary className="cursor-pointer text-sm font-semibold"><T>As minhas preferências de notificação</T></summary>
      <div className="mt-3 space-y-3 text-sm">
        {save.error && <ErrorText error={save.error} />}
        {save.isSuccess && <Alert tone="success"><T>Preferências guardadas.</T></Alert>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.emailEnabled} onChange={(e) => setF({ ...f, emailEnabled: e.target.checked })} /><T>Receber também por e-mail</T></label>
        <fieldset><legend className="label"><T>Receber estes alertas</T></legend>
          {data.mutableTypes.map((t: any) => <label key={t.type} className="flex items-center gap-2"><input type="checkbox" checked={!f.mutedTypes.includes(t.type)} onChange={(e) => setF({ ...f, mutedTypes: e.target.checked ? f.mutedTypes.filter((x: string) => x !== t.type) : [...f.mutedTypes, t.type] })} />{t.label}</label>)}
        </fieldset>
        <label className="flex items-center gap-2"><input type="checkbox" checked={quiet} onChange={(e) => setF({ ...f, quietStartHour: e.target.checked ? 22 : null, quietEndHour: e.target.checked ? 7 : null })} /><T>Horário de silêncio para e-mails (exceto alertas críticos)</T></label>
        {quiet && <div className="flex items-center gap-2"><T>das</T> <Input type="number" min={0} max={23} className="w-20" value={f.quietStartHour} onChange={(e) => setF({ ...f, quietStartHour: +e.target.value })} aria-label="Início" /> <T>às</T> <Input type="number" min={0} max={23} className="w-20" value={f.quietEndHour} onChange={(e) => setF({ ...f, quietEndHour: +e.target.value })} aria-label="Fim" /> <T>horas</T></div>}
        <p className="text-xs muted"><T>Notificações de segurança da conta e de faturação são sempre enviadas.</T></p>
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate(f)}><T>Guardar preferências</T></Button>
      </div>
    </details>
  );
}

/* ============================== Segurança da conta ============================== */
export function Security() {
  const me = useMeCtx();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { toast, toastEl } = useToast();
  const sessions = useApi<any[]>(["sessions"], me.mfaEnrollmentRequired ? null : "/api/auth/sessions");
  const revoke = useAction((id: string) => del(`/api/auth/sessions/${id}`), [["sessions"]]);
  const setup = useAction(() => post("/api/auth/2fa/setup"));
  const [code, setCode] = useState("");
  const enable = useAction((c: string) => post("/api/auth/2fa/enable", { code: c }), [["me"]]);
  const [dis, setDis] = useState({ password: "", code: "" });
  const disable = useAction((v: any) => post("/api/auth/2fa/disable", v), [["me"]]);
  const [pw, setPw] = useState({ current: "", next: "" });
  const changePw = useAction((v: any) => post("/api/auth/password", v), [["sessions"]]);
  const [name, setName] = useState(me.user.name);
  const profile = useAction((v: any) => api("/api/auth/me", { method: "PATCH", body: v }), [["me"]]);
  return (
    <>
      <PageHeader title="Segurança da conta" subtitle={me.user.email} />
      {(params.get("enroll") || me.mfaEnrollmentRequired) && !me.user.totpEnabled && <div className="mb-4"><Alert tone={me.mfaEnrollmentRequired ? "warning" : "info"}>{me.mfaEnrollmentRequired ? "A sua empresa exige autenticação de dois fatores (2FA). Configure-a para continuar." : "Recomendamos ativar o 2FA, sobretudo para administradores."}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Autenticação de dois fatores (TOTP)" actions={me.user.totpEnabled ? <Badge tone="green"><T>Ativa</T></Badge> : <Badge tone="amber"><T>Inativa</T></Badge>}>
          {!me.user.totpEnabled ? (
            enable.data ? (
              <div className="space-y-2 text-sm">
                <Alert tone="success"><T>2FA ativado. Guarde estes códigos de recuperação num local seguro — cada um só pode ser usado uma vez e não voltarão a ser mostrados.</T></Alert>
                <ul className="grid grid-cols-2 gap-1 rounded bg-slate-100 p-3 font-mono text-sm dark:bg-slate-800">{enable.data.recoveryCodes.map((c: string) => <li key={c}>{c}</li>)}</ul>
                <Button onClick={() => qc.invalidateQueries()}><T>Concluído</T></Button>
              </div>
            ) : !setup.data ? (
              <div className="space-y-2 text-sm"><p className="muted"><T>Compatível com Google Authenticator, Microsoft Authenticator e outras apps TOTP.</T></p><Button loading={setup.isPending} onClick={() => setup.mutate(undefined)}><T>Configurar 2FA</T></Button></div>
            ) : (
              <div className="space-y-3 text-sm">
                <p><T>1. Leia o código QR com a sua aplicação autenticadora.</T></p>
                <img src={setup.data.qr} alt="Código QR para configurar 2FA" className="h-44 w-44 rounded bg-white p-2" />
                <p className="muted"><T>Ou introduza a chave:</T> <span className="break-all font-mono">{setup.data.secret}</span></p>
                <p><T>2. Introduza o código de 6 dígitos gerado.</T></p>
                {enable.error && <ErrorText error={enable.error} />}
                <div className="flex gap-2"><Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-32" aria-label="Código 2FA" /><Button loading={enable.isPending} onClick={() => enable.mutate(code)}><T>Ativar</T></Button></div>
              </div>
            )
          ) : (
            <div className="space-y-2 text-sm">
              <p className="muted"><T>Para desativar, confirme a palavra-passe e um código. Pode não ser permitido pela política da empresa.</T></p>
              {disable.error && <ErrorText error={disable.error} />}
              <Input type="password" placeholder="Palavra-passe" value={dis.password} onChange={(e) => setDis({ ...dis, password: e.target.value })} />
              <Input placeholder="Código 2FA" value={dis.code} onChange={(e) => setDis({ ...dis, code: e.target.value })} />
              <Button variant="secondary" onClick={async () => { await disable.mutateAsync(dis); toast("2FA desativado."); }}><T>Desativar 2FA</T></Button>
            </div>
          )}
        </Card>
        {!me.mfaEnrollmentRequired && (
          <>
            <Card title="Sessões e dispositivos ativos">
              {sessions.isLoading ? <Loading /> : (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">{sessions.data?.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0"><p className="truncate">{s.userAgent || "Dispositivo desconhecido"}</p><p className="text-xs muted">IP {s.ip} · última atividade {fmtDateTime(s.lastSeenAt)}</p></div>
                    {s.current ? <Badge tone="green"><T>Esta sessão</T></Badge> : <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)} aria-label="Terminar sessão"><LogOut className="h-4 w-4" /></Button>}
                  </li>
                ))}</ul>
              )}
            </Card>
            <Card title="Perfil">
              <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" /><Button variant="secondary" onClick={async () => { await profile.mutateAsync({ name }); toast("Perfil atualizado."); }}><T>Guardar</T></Button></div>
            </Card>
            <Card title="Alterar palavra-passe">
              <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); await changePw.mutateAsync(pw); setPw({ current: "", next: "" }); toast("Palavra-passe alterada; outras sessões terminadas."); }}>
                {changePw.error && <ErrorText error={changePw.error} />}
                <Input type="password" autoComplete="current-password" placeholder="Palavra-passe atual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                <Input type="password" autoComplete="new-password" placeholder="Nova palavra-passe (mín. 10, letras e números)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                <Button loading={changePw.isPending}><T>Alterar</T></Button>
              </form>
            </Card>
          </>
        )}
      </div>
      {toastEl}
      {void can}
    </>
  );
}
