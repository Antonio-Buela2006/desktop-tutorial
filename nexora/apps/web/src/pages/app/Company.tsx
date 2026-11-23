import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, LogOut as ExitIcon, UserX, UserCheck, KeyRound } from "lucide-react";
import { del, fmtDate, fmtDateTime, fmtMoney, post, put, useAction, useApi } from "../../lib/api";
import { Alert, Badge, Button, Card, DataTable, ErrorState, ErrorText, Field, Input, Loading, Modal, PageHeader, Select, useConfirm, useToast } from "../../components/ui";
import { can } from "../../layouts/AppLayout";
import { useList, useMeCtx } from "./Business";

const levelLabel: Record<string, string> = { primary_admin: "Administrador principal", secondary_admin: "Administrador secundário", member: "Membro" };

function Capacity({ limits, usage }: { limits: any; usage: any }) {
  if (!limits) return null;
  const item = (label: string, used: number, max: number | null) => (
    <div className="card p-3">
      <p className="text-xs muted">{label}</p>
      <p className="text-lg font-semibold">{used} <span className="text-sm font-normal muted">/ {max ?? "sem limite configurado"}</span></p>
      {max !== null && <div className="mt-2 h-1.5 rounded bg-slate-200 dark:bg-slate-800"><div className={`h-1.5 rounded ${used >= max ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, (used / max) * 100)}%` }} /></div>}
    </div>
  );
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      {item("Funcionários registados", usage.employees, limits.maxEmployees)}
      {item("Utilizadores com conta", usage.users, limits.maxUsers)}
      {item("Administradores secundários", usage.secondaryAdmins, limits.maxSecondaryAdmins)}
    </div>
  );
}

/* ============================== Funcionários ============================== */
export function Employees() {
  const me = useMeCtx();
  const [status, setStatus] = useState("active");
  const list = useList("employees", "/api/company/employees", { status });
  const [edit, setEdit] = useState<any | null>(null);
  const [offboard, setOffboard] = useState<any | null>(null);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const remove = useAction((id: string) => del(`/api/company/employees/${id}`), [["employees"]]);
  const w = me.subscription.caps.write;
  const salary = can(me, "employees.view_salary");
  return (
    <>
      <PageHeader title="Funcionários" subtitle="Cadastro de pessoas da empresa — independente das contas de acesso." actions={can(me, "employees.create") && <Button disabled={!w} onClick={() => setEdit({})}><Plus className="h-4 w-4" /> Registar funcionário</Button>} />
      <Capacity limits={list.data?.limits} usage={list.data?.usage} />
      <DataTable rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="active">Ativos</option><option value="exited">Saídas</option><option value="all">Todos</option></Select>}
        columns={[
          { key: "fullName", header: "Nome", render: (r: any) => <span className="font-medium">{r.fullName}</span> },
          { key: "jobTitle", header: "Função", render: (r: any) => r.jobTitle ?? "—" },
          { key: "department", header: "Departamento", render: (r: any) => r.department ?? "—" },
          ...(salary ? [{ key: "salary", header: "Salário", render: (r: any) => fmtMoney(r.salary, me.tenant.currency) }] : []),
          { key: "account", header: "Conta", render: (r: any) => (r.account ? <Badge tone={r.account.status === "active" ? "green" : "gray"}>{r.account.status === "active" ? "Com acesso" : "Desativada"}</Badge> : <Badge>Sem conta</Badge>) },
          { key: "status", header: "Estado", render: (r: any) => (r.status === "active" ? <Badge tone="green">Ativo</Badge> : <Badge>Saída {fmtDate(r.exitDate)}</Badge>) },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => (
              <div className="flex justify-end gap-1">
                {can(me, "employees.edit") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setEdit(r)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}
                {r.status === "active" && can(me, "employees.offboard") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setOffboard(r)} aria-label="Registar saída"><ExitIcon className="h-4 w-4" /></Button>}
                {can(me, "employees.delete") && <Button size="sm" variant="ghost" disabled={!w} aria-label="Eliminar" onClick={async () => { if (await confirm("Eliminar registo", `O registo de ${r.fullName} vai para a lixeira.`)) { await remove.mutateAsync(r.id); toast("Registo movido para a lixeira."); } }}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ),
          },
        ]} />
      <EmployeeForm value={edit} salary={salary} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast("Funcionário guardado."); }} />
      <OffboardForm value={offboard} onClose={() => setOffboard(null)} onSaved={(r) => { setOffboard(null); toast(r.accountDisabled ? "Saída registada; acesso revogado e vaga libertada." : "Saída registada."); }} />
      {dialog}{toastEl}
    </>
  );
}

function EmployeeForm({ value, salary, onClose, onSaved }: { value: any | null; salary: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const save = useAction((v: any) => (value?.id ? put(`/api/company/employees/${value.id}`, v) : post("/api/company/employees", v)), [["employees"]]);
  const c = { fullName: "", email: "", jobTitle: "", department: "", hireDate: "", salary: "", ...value, ...f };
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <Modal open={value !== null} onClose={() => { setF({}); onClose(); }} title={value?.id ? "Editar funcionário" : "Registar funcionário"}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const body: any = { fullName: c.fullName, email: c.email || "", jobTitle: c.jobTitle || undefined, department: c.department || undefined, hireDate: c.hireDate || undefined };
        if (salary && c.salary !== "" && c.salary !== null) body.salary = Number(c.salary);
        await save.mutateAsync(body); setF({}); onSaved();
      }}>
        {save.error && <ErrorText error={save.error} />}
        <Field label="Nome completo"><Input required value={c.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="E-mail"><Input type="email" value={c.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Data de admissão"><Input type="date" value={c.hireDate ?? ""} onChange={(e) => set("hireDate", e.target.value)} /></Field>
          <Field label="Função"><Input value={c.jobTitle ?? ""} onChange={(e) => set("jobTitle", e.target.value)} /></Field>
          <Field label="Departamento"><Input value={c.department ?? ""} onChange={(e) => set("department", e.target.value)} /></Field>
          {salary && <Field label="Salário (sensível)"><Input type="number" min={0} value={c.salary ?? ""} onChange={(e) => set("salary", e.target.value)} /></Field>}
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Guardar</Button></div>
      </form>
    </Modal>
  );
}

function OffboardForm({ value, onClose, onSaved }: { value: any | null; onClose: () => void; onSaved: (r: any) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const save = useAction((v: any) => post(`/api/company/employees/${value.id}/offboard`, v), [["employees"], ["users"]]);
  return (
    <Modal open={value !== null} onClose={onClose} title={`Registar saída · ${value?.fullName ?? ""}`}>
      <div className="space-y-3">
        {save.error && <ErrorText error={save.error} />}
        <Alert tone="warning">Se o funcionário tiver conta, o acesso é revogado imediatamente (todas as sessões terminadas) e a vaga de utilizador é libertada. O histórico e a auditoria são preservados.</Alert>
        <Field label="Data de saída"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="danger" loading={save.isPending} onClick={async () => onSaved(await save.mutateAsync({ exitDate: date }))}>Confirmar saída</Button></div>
      </div>
    </Modal>
  );
}

/* ============================== Utilizadores ============================== */
export function UsersPage() {
  const me = useMeCtx();
  const { data, isLoading, error } = useApi<any>(["users"], "/api/company/users");
  const roles = useApi<any[]>(["roles"], can(me, "roles.view") ? "/api/company/roles" : null);
  const [invite, setInvite] = useState(false);
  const [access, setAccess] = useState<any | null>(null);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const disable = useAction((id: string) => post(`/api/company/users/${id}/disable`), [["users"]]);
  const enable = useAction((id: string) => post(`/api/company/users/${id}/enable`), [["users"]]);
  const revokeInv = useAction((id: string) => del(`/api/company/invitations/${id}`), [["users"]]);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const full = data.limits.maxUsers !== null && data.usage.users >= data.limits.maxUsers;
  const w = me.subscription.caps.write;
  return (
    <>
      <PageHeader title="Utilizadores" subtitle="Contas com acesso à Nexora, funções e permissões." actions={can(me, "users.invite") && <Button disabled={!w || full} onClick={() => setInvite(true)}><Plus className="h-4 w-4" /> Convidar</Button>} />
      <Capacity limits={data.limits} usage={data.usage} />
      {full && <div className="mb-4"><Alert tone="warning">Atingiu o limite de utilizadores do plano. As contas existentes continuam a funcionar. Para criar novas, compre utilizadores adicionais ou faça upgrade em <a className="underline" href="/app/billing">Subscrição</a>.</Alert></div>}
      {(disable.error || enable.error) && <div className="mb-3"><ErrorText error={disable.error || enable.error} /></div>}
      <DataTable rows={data.users} rowKey={(r: any) => r.id}
        columns={[
          { key: "name", header: "Nome", render: (r: any) => <div><p className="font-medium">{r.user.name}</p><p className="text-xs muted">{r.user.email}</p></div> },
          { key: "level", header: "Nível", render: (r: any) => <Badge tone={r.level === "member" ? "gray" : "blue"}>{levelLabel[r.level]}</Badge> },
          { key: "roles", header: "Funções", render: (r: any) => r.level === "primary_admin" ? <span className="text-xs muted">Todas as permissões</span> : r.roles.map((x: any) => <span key={x.roleId} className="mr-1"><Badge>{x.name}{x.validUntil ? ` até ${fmtDate(x.validUntil)}` : ""}</Badge></span>) },
          { key: "2fa", header: "2FA", render: (r: any) => (r.user.totpEnabled ? <Badge tone="green">Ativo</Badge> : <Badge tone="amber">Inativo</Badge>) },
          { key: "status", header: "Estado", render: (r: any) => (r.status === "active" ? <Badge tone="green">Ativo</Badge> : <Badge>Desativado</Badge>) },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => r.level !== "primary_admin" && r.id !== me.membership.id && (
              <div className="flex justify-end gap-1">
                {can(me, "users.edit") && r.status === "active" && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setAccess(r)} aria-label="Permissões"><KeyRound className="h-4 w-4" /></Button>}
                {can(me, "users.disable") && r.status === "active" && <Button size="sm" variant="ghost" disabled={!w} aria-label="Desativar" onClick={async () => { if (await confirm("Desativar utilizador", `O acesso de ${r.user.name} é revogado imediatamente e a vaga fica livre. O histórico é preservado.`)) { await disable.mutateAsync(r.id); toast("Utilizador desativado."); } }}><UserX className="h-4 w-4" /></Button>}
                {can(me, "users.edit") && r.status !== "active" && <Button size="sm" variant="ghost" disabled={!w} aria-label="Reativar" onClick={async () => { await enable.mutateAsync(r.id); toast("Utilizador reativado."); }}><UserCheck className="h-4 w-4" /></Button>}
              </div>
            ),
          },
        ]} />
      {data.invitations.length > 0 && (
        <Card title="Convites pendentes" className="mt-4">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">{data.invitations.map((i: any) => (
            <li key={i.id} className="flex items-center justify-between py-2"><span>{i.name} · {i.email} <span className="muted">(expira {fmtDate(i.expiresAt)})</span></span>{can(me, "users.invite") && <Button size="sm" variant="ghost" onClick={() => revokeInv.mutate(i.id)}>Revogar</Button>}</li>
          ))}</ul>
        </Card>
      )}
      {invite && <InviteForm roles={roles.data ?? []} onClose={() => setInvite(false)} onSaved={(link) => { setInvite(false); toast(link ? "Convite criado (link de desenvolvimento copiado para a consola)." : "Convite enviado."); if (link) console.info("Link do convite:", link); }} />}
      {access && <AccessEditor member={access} roles={roles.data ?? []} onClose={() => setAccess(null)} onSaved={() => { setAccess(null); toast("Permissões atualizadas."); }} />}
      {dialog}{toastEl}
    </>
  );
}

function InviteForm({ roles, onClose, onSaved }: { roles: any[]; onClose: () => void; onSaved: (link?: string) => void }) {
  const me = useMeCtx();
  const [f, setF] = useState({ email: "", name: "", roleIds: [] as string[], level: "member" });
  const [link, setLink] = useState<string | null>(null);
  const save = useAction((v: any) => post("/api/company/users/invite", v), [["users"]]);
  return (
    <Modal open onClose={onClose} title="Convidar utilizador">
      {link ? (
        <div className="space-y-3 text-sm">
          <Alert tone="success">Convite criado. Em produção o link segue apenas por e-mail.</Alert>
          <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-800">{link}</p>
          <div className="flex justify-end"><Button onClick={() => onSaved(link)}>Fechar</Button></div>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const r = await save.mutateAsync(f); if (r.devLink) setLink(r.devLink); else onSaved(); }}>
          {save.error && <ErrorText error={save.error} />}
          <Field label="Nome"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          {me.membership.level === "primary_admin" && <Field label="Nível"><Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="member">Membro</option><option value="secondary_admin">Administrador secundário</option></Select></Field>}
          <fieldset><legend className="label">Funções</legend>
            <div className="grid gap-1 sm:grid-cols-2">{roles.map((r) => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.roleIds.includes(r.id)} onChange={(e) => setF({ ...f, roleIds: e.target.checked ? [...f.roleIds, r.id] : f.roleIds.filter((x) => x !== r.id) })} />{r.name}</label>)}</div>
          </fieldset>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Enviar convite</Button></div>
        </form>
      )}
    </Modal>
  );
}

function AccessEditor({ member, roles, onClose, onSaved }: { member: any; roles: any[]; onClose: () => void; onSaved: () => void }) {
  const cur = useApi<any>(["access", member.id], `/api/company/users/${member.id}/access`);
  const perms = useApi<any[]>(["perms"], "/api/meta/permissions");
  const [state, setState] = useState<{ roles: any[]; overrides: any[] } | null>(null);
  useEffect(() => {
    if (cur.data && !state) setState({ roles: cur.data.roles.map((r: any) => ({ roleId: r.roleId, validUntil: r.validUntil?.slice(0, 10) ?? "" })), overrides: cur.data.overrides.map((o: any) => ({ permission: o.permission, effect: o.effect, validUntil: o.validUntil?.slice(0, 10) ?? "" })) });
  }, [cur.data, state]);
  const save = useAction((v: any) => put(`/api/company/users/${member.id}/access`, v), [["users"]]);
  if (!state) return <Modal open onClose={onClose} title="Permissões"><Loading /></Modal>;
  const toDate = (d: string) => (d ? new Date(d + "T23:59:59").toISOString() : null);
  return (
    <Modal open onClose={onClose} title={`Acesso · ${member.user.name}`} wide>
      <div className="space-y-4">
        {save.error && <ErrorText error={save.error} />}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Funções (validade opcional para substituições temporárias)</h3>
          <div className="space-y-2">{roles.map((r) => {
            const a = state.roles.find((x) => x.roleId === r.id);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex w-56 items-center gap-2"><input type="checkbox" checked={!!a} onChange={(e) => setState({ ...state, roles: e.target.checked ? [...state.roles, { roleId: r.id, validUntil: "" }] : state.roles.filter((x) => x.roleId !== r.id) })} />{r.name}</label>
                {a && <label className="flex items-center gap-2 text-xs muted">até <input type="date" className="input w-40" value={a.validUntil} onChange={(e) => setState({ ...state, roles: state.roles.map((x) => (x.roleId === r.id ? { ...x, validUntil: e.target.value } : x)) })} /></label>}
              </div>
            );
          })}</div>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Ajustes individuais</h3>
          {state.overrides.map((o, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_110px_150px_auto] items-center gap-2">
              <Select value={o.permission} onChange={(e) => setState({ ...state, overrides: state.overrides.map((x, j) => (j === i ? { ...x, permission: e.target.value } : x)) })}>{perms.data?.map((p) => <option key={p.key} value={p.key}>{p.label} ({p.key})</option>)}</Select>
              <Select value={o.effect} onChange={(e) => setState({ ...state, overrides: state.overrides.map((x, j) => (j === i ? { ...x, effect: e.target.value } : x)) })}><option value="grant">Conceder</option><option value="deny">Negar</option></Select>
              <Input type="date" aria-label="Válido até" value={o.validUntil} onChange={(e) => setState({ ...state, overrides: state.overrides.map((x, j) => (j === i ? { ...x, validUntil: e.target.value } : x)) })} />
              <Button size="sm" variant="ghost" onClick={() => setState({ ...state, overrides: state.overrides.filter((_, j) => j !== i) })} aria-label="Remover ajuste"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setState({ ...state, overrides: [...state.overrides, { permission: perms.data?.[0]?.key, effect: "grant", validUntil: "" }] })}><Plus className="h-4 w-4" /> Ajuste</Button>
        </section>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={save.isPending} onClick={async () => { await save.mutateAsync({ roles: state.roles.map((r) => ({ roleId: r.roleId, validUntil: toDate(r.validUntil) })), overrides: state.overrides.map((o) => ({ permission: o.permission, effect: o.effect, validUntil: toDate(o.validUntil) })) }); onSaved(); }}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================== Funções ============================== */
export function Roles() {
  const me = useMeCtx();
  const { data, isLoading, error } = useApi<any[]>(["roles"], "/api/company/roles");
  const perms = useApi<any[]>(["perms"], "/api/meta/permissions");
  const [edit, setEdit] = useState<any | null>(null);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const remove = useAction((id: string) => del(`/api/company/roles/${id}`), [["roles"]]);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const manage = can(me, "roles.manage") && me.subscription.caps.write;
  return (
    <>
      <PageHeader title="Funções e permissões" subtitle="Funções predefinidas e personalizadas. Permissões granulares validadas no servidor." actions={manage && <Button onClick={() => setEdit({ name: "", description: "", permissions: [] })}><Plus className="h-4 w-4" /> Nova função</Button>} />
      {remove.error && <div className="mb-3"><ErrorText error={remove.error} /></div>}
      <div className="grid gap-3 md:grid-cols-2">
        {data!.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div><h2 className="font-semibold">{r.name} {r.isSystem && <Badge>Predefinida</Badge>}</h2><p className="text-sm muted">{r.description}</p></div>
              {manage && <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(r)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>{!r.isSystem && <Button size="sm" variant="ghost" aria-label="Eliminar" onClick={async () => { if (await confirm("Eliminar função", r.name)) { await remove.mutateAsync(r.id); toast("Função eliminada."); } }}><Trash2 className="h-4 w-4" /></Button>}</div>}
            </div>
            <p className="mt-2 text-xs muted">{r.permissions.length} permissões · {r.members} atribuição(ões)</p>
          </div>
        ))}
      </div>
      {edit && <RoleForm role={edit} perms={perms.data ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast("Função guardada."); }} />}
      {dialog}{toastEl}
    </>
  );
}

function RoleForm({ role, perms, onClose, onSaved }: { role: any; perms: any[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: role.name, description: role.description, permissions: role.permissions as string[] });
  const save = useAction((v: any) => (role.id ? put(`/api/company/roles/${role.id}`, v) : post("/api/company/roles", v)), [["roles"]]);
  const groups = perms.reduce<Record<string, any[]>>((g, p) => ((g[p.key.split(".")[0]] ??= []).push(p), g), {});
  return (
    <Modal open onClose={onClose} title={role.id ? `Editar função · ${role.name}` : "Nova função"} wide>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync(f); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(groups).map(([g, list]) => (
            <fieldset key={g} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <legend className="px-1 text-xs font-semibold uppercase muted">{g}{list[0].module ? " · módulo" : ""}</legend>
              {list.map((p) => (
                <label key={p.key} className="flex items-center gap-2 py-0.5 text-sm">
                  <input type="checkbox" checked={f.permissions.includes(p.key)} onChange={(e) => setF({ ...f, permissions: e.target.checked ? [...f.permissions, p.key] : f.permissions.filter((x) => x !== p.key) })} />
                  {p.label}{p.adminOnly && <Badge tone="amber">admin</Badge>}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Guardar</Button></div>
      </form>
    </Modal>
  );
}

/* ============================== Definições ============================== */
export function Settings() {
  const me = useMeCtx();
  const { data, isLoading } = useApi<any>(["settings"], "/api/company/settings");
  const users = useApi<any>(["users"], can(me, "users.view") ? "/api/company/users" : null);
  const pending = useApi<any>(["ownership"], "/api/company/ownership/pending");
  const grants = useApi<any[]>(["grants"], can(me, "support.grant") ? "/api/support/grants" : null);
  const [f, setF] = useState<any>(null);
  const { toast, toastEl } = useToast();
  useEffect(() => { if (data && !f) setF(data); }, [data, f]);
  const save = useAction((v: any) => put("/api/company/settings", v), [["settings"], ["me"]]);
  const [transfer, setTransfer] = useState({ to: "", password: "" });
  const doTransfer = useAction((v: any) => post("/api/company/ownership/transfer", v));
  const [acceptPw, setAcceptPw] = useState("");
  const accept = useAction((id: string) => post(`/api/company/ownership/${id}/accept`, { password: acceptPw }), [["me"], ["ownership"]]);
  const [grant, setGrant] = useState({ platformAdminEmail: "", reason: "", scope: [] as string[], hours: 4 });
  const createGrant = useAction((v: any) => post("/api/support/grants", v), [["grants"]]);
  const revokeGrant = useAction((id: string) => post(`/api/support/grants/${id}/revoke`), [["grants"]]);
  if (isLoading || !f) return <Loading />;
  const manage = can(me, "settings.manage");
  const st = f.settings;
  const setS = (k: string, v: any) => setF({ ...f, settings: { ...st, [k]: v } });
  return (
    <>
      <PageHeader title="Definições da empresa" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Empresa e segurança">
          <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ name: f.name, legalName: f.legalName, taxId: f.taxId, defaultLocale: f.defaultLocale, settings: { require2fa: st.require2fa, idleTimeoutMinutes: +st.idleTimeoutMinutes, maxSessionsPerUser: +st.maxSessionsPerUser, languages: st.languages, dateLocale: st.dateLocale, trashRetentionDays: +st.trashRetentionDays } }); toast("Definições guardadas."); }}>
            {save.error && <ErrorText error={save.error} />}
            <fieldset disabled={!manage} className="space-y-3">
              <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Denominação legal"><Input value={f.legalName ?? ""} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
                <Field label="NIF"><Input value={f.taxId ?? ""} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
                <Field label="Exigir 2FA"><Select value={st.require2fa} onChange={(e) => setS("require2fa", e.target.value)}><option value="off">Opcional</option><option value="admins">Administradores</option><option value="all">Todos</option></Select></Field>
                <Field label="Sessão inativa (min)"><Input type="number" min={5} max={480} value={st.idleTimeoutMinutes} onChange={(e) => setS("idleTimeoutMinutes", e.target.value)} /></Field>
                <Field label="Máx. dispositivos por utilizador"><Input type="number" min={1} max={20} value={st.maxSessionsPerUser} onChange={(e) => setS("maxSessionsPerUser", e.target.value)} /></Field>
                <Field label="Lixeira (dias)"><Input type="number" min={7} max={365} value={st.trashRetentionDays} onChange={(e) => setS("trashRetentionDays", e.target.value)} /></Field>
                <Field label="Idioma por omissão"><Select value={f.defaultLocale} onChange={(e) => setF({ ...f, defaultLocale: e.target.value })}><option value="pt">Português</option><option value="en">English</option></Select></Field>
              </div>
              {manage && <Button loading={save.isPending}>Guardar</Button>}
            </fieldset>
          </form>
        </Card>
        <div className="space-y-4">
          {pending.data && (
            <Card title="Transferência de administração pendente">
              <p className="text-sm">Foi-lhe proposta a administração principal desta empresa.</p>
              {accept.error && <ErrorText error={accept.error} />}
              <div className="mt-2 flex gap-2"><Input type="password" placeholder="Confirme a sua palavra-passe" value={acceptPw} onChange={(e) => setAcceptPw(e.target.value)} /><Button onClick={async () => { await accept.mutateAsync(pending.data.id); toast("É agora o administrador principal."); }}>Aceitar</Button></div>
            </Card>
          )}
          {me.membership.level === "primary_admin" && (
            <Card title="Transferir administração principal">
              <p className="mb-2 text-sm muted">Processo seguro: requer a sua palavra-passe e a confirmação do destinatário. Fica auditado.</p>
              {doTransfer.error && <ErrorText error={doTransfer.error} />}
              {doTransfer.isSuccess && <Alert tone="success">Pedido enviado. Aguarda confirmação do destinatário (72h).</Alert>}
              <div className="space-y-2">
                <Select value={transfer.to} onChange={(e) => setTransfer({ ...transfer, to: e.target.value })}><option value="">Escolher utilizador…</option>{users.data?.users.filter((u: any) => u.status === "active" && u.level !== "primary_admin").map((u: any) => <option key={u.id} value={u.id}>{u.user.name}</option>)}</Select>
                <Input type="password" placeholder="A sua palavra-passe" value={transfer.password} onChange={(e) => setTransfer({ ...transfer, password: e.target.value })} />
                <Button variant="danger" disabled={!transfer.to || !transfer.password} onClick={() => doTransfer.mutate({ toMembershipId: transfer.to, password: transfer.password })}>Pedir transferência</Button>
              </div>
            </Card>
          )}
          {can(me, "support.grant") && (
            <Card title="Acesso de suporte (excecional)">
              <p className="mb-2 text-sm muted">Os técnicos Nexora não têm acesso livre aos seus dados. Autorize acesso só ao necessário, por tempo limitado. Tudo fica auditado.</p>
              {createGrant.error && <ErrorText error={createGrant.error} />}
              <div className="space-y-2">
                <Input type="email" placeholder="E-mail do técnico Nexora" value={grant.platformAdminEmail} onChange={(e) => setGrant({ ...grant, platformAdminEmail: e.target.value })} />
                <Input placeholder="Motivo (mín. 10 caracteres)" value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} />
                <div className="flex flex-wrap gap-3 text-sm">{["customers", "products", "sales_orders", "finance_transactions", "employees"].map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" checked={grant.scope.includes(s)} onChange={(e) => setGrant({ ...grant, scope: e.target.checked ? [...grant.scope, s] : grant.scope.filter((x) => x !== s) })} />{s}</label>)}</div>
                <div className="flex items-center gap-2 text-sm">Duração <Input type="number" min={1} max={72} className="w-20" value={grant.hours} onChange={(e) => setGrant({ ...grant, hours: +e.target.value })} /> horas</div>
                <Button onClick={async () => { await createGrant.mutateAsync(grant); toast("Acesso temporário autorizado."); }}>Autorizar</Button>
              </div>
              <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">{grants.data?.map((g) => {
                const active = !g.revokedAt && new Date(g.endsAt) > new Date();
                return <li key={g.id} className="flex items-center justify-between py-2"><span>{g.platformAdminEmail} · {g.scope.join(", ")} · até {fmtDateTime(g.endsAt)} {active ? <Badge tone="green">Ativo</Badge> : <Badge>Terminado</Badge>}</span>{active && <Button size="sm" variant="ghost" onClick={() => revokeGrant.mutate(g.id)}>Revogar</Button>}</li>;
              })}</ul>
            </Card>
          )}
        </div>
      </div>
      {toastEl}
    </>
  );
}
