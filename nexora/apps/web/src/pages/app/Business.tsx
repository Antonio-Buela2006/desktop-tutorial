import { useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Trash2, Pencil, PackagePlus, Ban, Check, X, Paperclip } from "lucide-react";
import { DocumentsModal } from "../../components/Documents";
import { del, fmtDate, fmtDateTime, fmtMoney, fmtNum, post, put, useAction, useApi, type Me } from "../../lib/api";
import { Alert, Badge, Button, Card, DataTable, ErrorState, ErrorText, Field, Input, Loading, Modal, PageHeader, Select, Stat, useConfirm, useToast, useUnsavedGuard } from "../../components/ui";
import { can } from "../../layouts/AppLayout";

export const useMeCtx = () => useOutletContext<Me>();

/** Unidades visíveis para o utilizador (todas, ou só as do seu âmbito). */
export function useBranches() {
  const me = useMeCtx();
  const { data } = useApi<any[]>(["branches"], "/api/company/branches");
  const all = (data ?? []).filter((b) => b.isActive);
  return me.membership.branchScope ? all.filter((b) => me.membership.branchScope!.includes(b.id)) : all;
}

export function BranchSelect({ value, onChange, allLabel = "Todas as unidades", required }: { value: string; onChange: (v: string) => void; allLabel?: string; required?: boolean }) {
  const branches = useBranches();
  if (!branches.length) return null;
  return (
    <Select aria-label="Unidade" value={value} onChange={(e) => onChange(e.target.value)} className="w-48" required={required}>
      <option value="">{allLabel}</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
    </Select>
  );
}

/** Estado de listagem paginada no servidor com pesquisa (debounce simples). */
export function useList<T = any>(key: string, base: string, extra: Record<string, string> = {}) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });
  const qs = new URLSearchParams({ page: String(page), pageSize: "20", ...(q ? { q } : {}), sort: sort.key, dir: sort.dir, ...extra });
  const res = useApi<{ items: T[]; total: number } & Record<string, any>>([key, qs.toString()], `${base}?${qs}`);
  return {
    ...res, page, setPage, q, setQ: (v: string) => { setQ(v); setPage(1); }, sort,
    onSort: (k: string) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" })),
  };
}

/* ============================== Dashboard ============================== */
export function Dashboard() {
  const me = useMeCtx();
  const [branch, setBranch] = useState("");
  const { data, isLoading, error } = useApi<any>(["dashboard", branch], `/api/dashboard${branch ? `?branchId=${branch}` : ""}`);
  const cur = me.tenant.currency;
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const s = data.sales;
  const delta = s && s.previousMonth ? Math.round(((s.month - s.previousMonth) / s.previousMonth) * 100) : null;
  return (
    <>
      <PageHeader title={`Olá, ${me.user.name.split(" ")[0]}`} subtitle={`${me.tenant.name} · indicadores adaptados às suas permissões${me.membership.branchScope ? " e unidades" : ""}`} actions={<BranchSelect value={branch} onChange={setBranch} />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {s && <Stat label="Vendas do mês" value={fmtMoney(s.month, cur)} hint={delta !== null ? `${delta >= 0 ? "+" : ""}${delta}% vs mês anterior completo` : undefined} tone={delta !== null ? (delta >= 0 ? "up" : "down") : undefined} />}
        {data.finance && <Stat label="Resultado do mês" value={fmtMoney(data.finance.result, cur)} hint={`${data.finance.pendingApprovals} despesa(s) por aprovar`} />}
        {data.inventory && <Stat label="Stock baixo" value={fmtNum(data.inventory.lowStock.length)} hint={`de ${data.inventory.products} produtos`} tone={data.inventory.lowStock.length ? "down" : undefined} />}
        {data.customers && <Stat label="Clientes" value={fmtNum(data.customers.total)} />}
        {data.employees && <Stat label="Funcionários ativos" value={fmtNum(data.employees.active)} />}
      </div>
      <Onboarding />
      {!Object.keys(data).length && <Alert>O seu perfil ainda não tem acesso a indicadores de negócio. Peça ao administrador as permissões necessárias.</Alert>}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {data.salesByMonth && (
          <Card title="Vendas por mês" className="lg:col-span-2">
            <div className="h-64" role="img" aria-label="Gráfico de vendas dos últimos 6 meses">
              <ResponsiveContainer>
                <BarChart data={data.salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: any) => fmtMoney(v, cur)} />
                  <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {data.inventory && (
          <Card title="Produtos a repor">
            {!data.inventory.lowStock.length ? <p className="text-sm muted">Nenhum produto abaixo do nível de reposição.</p> : (
              <ul className="space-y-2 text-sm">{data.inventory.lowStock.map((p: any) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><Badge tone="red">{p.stockQty} / {p.reorderLevel}</Badge></li>)}</ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Onboarding() {
  const { data } = useApi<any>(["onboarding"], "/api/company/onboarding");
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("nx-onboarding-hidden") === "1"; } catch { return false; } });
  if (!data || hidden || data.completed === data.total) return null;
  return (
    <div className="card mt-6 p-4">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="font-semibold">Primeiros passos</h2><p className="text-sm muted">{data.completed} de {data.total} concluídos</p></div>
        <button className="text-xs muted underline" onClick={() => { setHidden(true); try { localStorage.setItem("nx-onboarding-hidden", "1"); } catch {} }}>Ocultar</button>
      </div>
      <div className="mt-2 h-1.5 rounded bg-slate-200 dark:bg-slate-800"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${(data.completed / data.total) * 100}%` }} /></div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.steps.map((s: any) => (
          <li key={s.key}><a href={s.link} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${s.done ? "bg-emerald-500 text-white" : "border border-slate-300 dark:border-slate-600"}`}>{s.done ? "✓" : ""}</span>
            <span className={s.done ? "muted line-through" : ""}>{s.label}</span>
          </a></li>
        ))}
      </ul>
    </div>
  );
}

/* ============================== Clientes ============================== */
export function Customers() {
  const me = useMeCtx();
  const list = useList("customers", "/api/crm/customers");
  const [edit, setEdit] = useState<any | null>(null);
  const [docs, setDocs] = useState<any | null>(null);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const remove = useAction((id: string) => del(`/api/crm/customers/${id}`), [["customers"]]);
  const w = me.subscription.caps.write;
  return (
    <>
      <PageHeader title="Clientes" subtitle="Cadastro e contactos comerciais." actions={can(me, "crm.create") && <Button disabled={!w} onClick={() => setEdit({})}><Plus className="h-4 w-4" /> Novo cliente</Button>} />
      <DataTable
        rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error}
        search={list.q} onSearch={list.setQ} sort={list.sort} onSort={list.onSort}
        columns={[
          { key: "name", header: "Nome", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
          { key: "email", header: "E-mail", render: (r: any) => r.email ?? "—" },
          { key: "phone", header: "Telefone", render: (r: any) => r.phone ?? "—" },
          { key: "taxId", header: "NIF", render: (r: any) => r.taxId ?? "—" },
          { key: "createdAt", header: "Criado", sortable: true, render: (r: any) => fmtDate(r.createdAt) },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDocs(r)} aria-label={`Documentos de ${r.name}`}><Paperclip className="h-4 w-4" /></Button>
                {can(me, "crm.edit") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setEdit(r)} aria-label={`Editar ${r.name}`}><Pencil className="h-4 w-4" /></Button>}
                {can(me, "crm.delete") && <Button size="sm" variant="ghost" disabled={!w} aria-label={`Eliminar ${r.name}`} onClick={async () => { if (await confirm("Eliminar cliente", <>O cliente <strong>{r.name}</strong> vai para a lixeira e pode ser restaurado durante 30 dias.</>)) { await remove.mutateAsync(r.id); toast("Cliente movido para a lixeira."); } }}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ),
          },
        ]}
      />
      {docs && <DocumentsModal entityType="customer" entity={{ id: docs.id, name: docs.name }} canEdit={can(me, "crm.edit") && w} onClose={() => setDocs(null)} />}
      <CustomerForm value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast("Cliente guardado."); }} />
      {dialog}{toastEl}
    </>
  );
}

function CustomerForm({ value, onClose, onSaved }: { value: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty);
  const save = useAction((v: any) => (value?.id ? put(`/api/crm/customers/${value.id}`, v) : post("/api/crm/customers", v)), [["customers"]]);
  const open = value !== null;
  const cur = { name: "", email: "", phone: "", taxId: "", notes: "", ...value, ...f };
  const set = (k: string, v: string) => { setF((x: any) => ({ ...x, [k]: v })); setDirty(true); };
  return (
    <Modal open={open} onClose={() => { setF({}); setDirty(false); onClose(); }} title={value?.id ? "Editar cliente" : "Novo cliente"}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ name: cur.name, email: cur.email || "", phone: cur.phone || undefined, taxId: cur.taxId || undefined, notes: cur.notes || undefined }); setF({}); setDirty(false); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <Field label="Nome"><Input required minLength={2} value={cur.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="E-mail"><Input type="email" value={cur.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Telefone"><Input value={cur.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label="NIF"><Input value={cur.taxId ?? ""} onChange={(e) => set("taxId", e.target.value)} /></Field>
        <Field label="Notas"><textarea className="input" rows={3} value={cur.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Guardar</Button></div>
      </form>
    </Modal>
  );
}

/* ============================== Stock ============================== */
export function Products() {
  const me = useMeCtx();
  const [params] = useSearchParams();
  const [low, setLow] = useState(params.get("lowStock") === "1");
  const list = useList("products", "/api/inventory/products", low ? { lowStock: "true" } : {});
  const [edit, setEdit] = useState<any | null>(null);
  const [adjust, setAdjust] = useState<any | null>(null);
  const [showMoves, setShowMoves] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const remove = useAction((id: string) => del(`/api/inventory/products/${id}`), [["products"]]);
  const w = me.subscription.caps.write;
  const cur = me.tenant.currency;
  return (
    <>
      <PageHeader title="Stock e inventário" subtitle="Produtos, níveis de stock e ajustes rastreáveis." actions={<>
        <Button variant="secondary" onClick={() => setShowMoves(true)}>Movimentos</Button>
        {can(me, "inventory.create") && <Button disabled={!w} onClick={() => setEdit({})}><Plus className="h-4 w-4" /> Novo produto</Button>}
      </>} />
      <DataTable
        rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> Só stock baixo</label>}
        columns={[
          { key: "sku", header: "SKU" },
          { key: "name", header: "Produto", render: (r: any) => <span className="font-medium">{r.name}</span> },
          { key: "unitPrice", header: "Preço", render: (r: any) => fmtMoney(r.unitPrice, cur) },
          { key: "stockQty", header: "Stock", render: (r: any) => <Badge tone={r.stockQty <= r.reorderLevel ? "red" : "green"}>{fmtNum(r.stockQty)}</Badge> },
          { key: "reorderLevel", header: "Repor a", render: (r: any) => fmtNum(r.reorderLevel) },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => (
              <div className="flex justify-end gap-1">
                {can(me, "inventory.adjust") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setAdjust(r)} aria-label={`Ajustar stock de ${r.name}`}><PackagePlus className="h-4 w-4" /></Button>}
                {can(me, "inventory.edit") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setEdit(r)} aria-label={`Editar ${r.name}`}><Pencil className="h-4 w-4" /></Button>}
                {can(me, "inventory.delete") && <Button size="sm" variant="ghost" disabled={!w} aria-label={`Eliminar ${r.name}`} onClick={async () => { if (await confirm("Eliminar produto", `${r.sku} vai para a lixeira (recuperável durante 30 dias).`)) { await remove.mutateAsync(r.id); toast("Produto movido para a lixeira."); } }}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ),
          },
        ]}
      />
      <ProductForm value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast("Produto guardado."); }} />
      <AdjustForm value={adjust} onClose={() => setAdjust(null)} onSaved={() => { setAdjust(null); toast("Stock ajustado."); }} />
      <Modal open={showMoves} onClose={() => setShowMoves(false)} title="Movimentos de stock" wide>{showMoves && <Movements />}</Modal>
      {dialog}{toastEl}
    </>
  );
}

function Movements() {
  const list = useList("movements", "/api/inventory/movements");
  return (
    <DataTable rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error}
      columns={[
        { key: "createdAt", header: "Data", render: (r: any) => fmtDateTime(r.createdAt) },
        { key: "product", header: "Produto" },
        { key: "delta", header: "Qtd", render: (r: any) => <span className={r.delta < 0 ? "text-rose-600" : "text-emerald-600"}>{r.delta > 0 ? "+" : ""}{r.delta}</span> },
        { key: "reason", header: "Motivo" },
      ]} />
  );
}

function ProductForm({ value, onClose, onSaved }: { value: any | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const save = useAction((v: any) => (value?.id ? put(`/api/inventory/products/${value.id}`, v) : post("/api/inventory/products", v)), [["products"], ["dashboard"]]);
  const cur = { sku: "", name: "", unitPrice: 0, unitCost: 0, reorderLevel: 0, initialStock: 0, ...value, ...f };
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <Modal open={value !== null} onClose={() => { setF({}); onClose(); }} title={value?.id ? "Editar produto" : "Novo produto"}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const { sku, name, unitPrice, unitCost, reorderLevel, initialStock } = cur; await save.mutateAsync(value?.id ? { sku, name, unitPrice: +unitPrice, unitCost: +unitCost, reorderLevel: +reorderLevel } : { sku, name, unitPrice: +unitPrice, unitCost: +unitCost, reorderLevel: +reorderLevel, initialStock: +initialStock }); setF({}); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU"><Input required value={cur.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Nome"><Input required value={cur.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Preço de venda"><Input type="number" min={0} step="0.01" value={cur.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} /></Field>
          <Field label="Custo unitário"><Input type="number" min={0} step="0.01" value={cur.unitCost} onChange={(e) => set("unitCost", e.target.value)} /></Field>
          <Field label="Nível de reposição"><Input type="number" min={0} value={cur.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} /></Field>
          {!value?.id && <Field label="Stock inicial"><Input type="number" min={0} value={cur.initialStock} onChange={(e) => set("initialStock", e.target.value)} /></Field>}
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Guardar</Button></div>
      </form>
    </Modal>
  );
}

function AdjustForm({ value, onClose, onSaved }: { value: any | null; onClose: () => void; onSaved: () => void }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const save = useAction((v: any) => post(`/api/inventory/products/${value.id}/adjust`, v), [["products"], ["dashboard"], ["movements"]]);
  return (
    <Modal open={value !== null} onClose={onClose} title={`Ajustar stock · ${value?.name ?? ""}`}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ delta: +delta, reason }); setDelta(0); setReason(""); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <p className="text-sm">Stock atual: <strong>{value?.stockQty}</strong> → depois do ajuste: <strong>{(value?.stockQty ?? 0) + Number(delta || 0)}</strong></p>
        <Field label="Quantidade (+ entrada / − saída)"><Input type="number" required value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></Field>
        <Field label="Motivo"><Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Inventário, quebra, devolução…" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Confirmar ajuste</Button></div>
      </form>
    </Modal>
  );
}

/* ============================== Vendas ============================== */
export function Sales() {
  const me = useMeCtx();
  const [branch, setBranch] = useState("");
  const branches = useBranches();
  const list = useList("sales", "/api/sales/orders", branch ? { branchId: branch } : {});
  const [creating, setCreating] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const cancel = useAction((id: string) => post(`/api/sales/orders/${id}/cancel`), [["sales"], ["products"], ["dashboard"]]);
  const w = me.subscription.caps.write;
  const cur = me.tenant.currency;
  return (
    <>
      <PageHeader title="Vendas" subtitle="Cada venda dá baixa de stock automaticamente, numa única transação." actions={can(me, "sales.create") && <Button disabled={!w} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nova venda</Button>} />
      <DataTable rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<BranchSelect value={branch} onChange={setBranch} />}
        columns={[
          ...(branches.length ? [{ key: "branch", header: "Unidade", render: (r: any) => branches.find((b) => b.id === r.branchId)?.name ?? "—" }] : []),
          { key: "number", header: "N.º", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
          { key: "soldAt", header: "Data", render: (r: any) => fmtDate(r.soldAt) },
          { key: "customer", header: "Cliente", render: (r: any) => r.customer ?? "Consumidor final" },
          { key: "lines", header: "Itens", render: (r: any) => r.lines.map((l: any) => `${l.quantity}× ${l.name}`).join(", ") },
          { key: "total", header: "Total", render: (r: any) => <strong>{fmtMoney(r.total, cur)}</strong> },
          { key: "status", header: "Estado", render: (r: any) => <Badge tone={r.status === "confirmed" ? "green" : "gray"}>{r.status === "confirmed" ? "Confirmada" : "Anulada"}</Badge> },
          { key: "a", header: "", className: "text-right", render: (r: any) => r.status === "confirmed" && can(me, "sales.cancel") && <Button size="sm" variant="ghost" disabled={!w} aria-label={`Anular ${r.number}`} onClick={async () => { if (await confirm("Anular venda", `A venda ${r.number} será anulada e o stock reposto.`)) { await cancel.mutateAsync(r.id); toast("Venda anulada."); } }}><Ban className="h-4 w-4" /></Button> },
        ]} />
      {creating && <SaleForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); toast("Venda registada."); }} />}
      {dialog}{toastEl}
    </>
  );
}

function SaleForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const me = useMeCtx();
  const prods = useApi<any>(["products-all"], "/api/inventory/products?pageSize=100");
  const custs = useApi<any>(["customers-all"], can(me, "crm.view") ? "/api/crm/customers?pageSize=100&sort=name&dir=asc" : null);
  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState(me.membership.branchScope?.length === 1 ? me.membership.branchScope[0] : "");
  const [lines, setLines] = useState([{ productId: "", quantity: 1 }]);
  const save = useAction((v: any) => post("/api/sales/orders", v), [["sales"], ["products"], ["dashboard"]]);
  const items = prods.data?.items ?? [];
  const total = lines.reduce((s, l) => s + (items.find((p: any) => p.id === l.productId)?.unitPrice ?? 0) * l.quantity, 0);
  return (
    <Modal open onClose={onClose} title="Nova venda" wide>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ customerId: customerId || undefined, branchId: branchId || null, lines: lines.filter((l) => l.productId) }); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <div className="[&_select]:w-full"><BranchField value={branchId} onChange={setBranchId} /></div>
        {custs.data && <Field label="Cliente"><Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Consumidor final</option>{custs.data.items.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
            <Field label={i === 0 ? "Produto" : ""}><Select required value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}><option value="">Escolher…</option>{items.map((p: any) => <option key={p.id} value={p.id} disabled={p.stockQty <= 0}>{p.sku} · {p.name} ({p.stockQty} em stock)</option>)}</Select></Field>
            <Field label={i === 0 ? "Qtd" : ""}><Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, +e.target.value) } : x)))} /></Field>
            <Button type="button" variant="ghost" aria-label="Remover linha" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, { productId: "", quantity: 1 }])}><Plus className="h-4 w-4" /> Linha</Button>
        <p className="text-right text-lg font-semibold">Total: {fmtMoney(total, me.tenant.currency)}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Registar venda</Button></div>
      </form>
    </Modal>
  );
}

/* ============================== Finanças ============================== */
export function Finance() {
  const me = useMeCtx();
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const list = useList("finance", "/api/finance/transactions", { ...(status ? { status } : {}), ...(branch ? { branchId: branch } : {}) });
  const [creating, setCreating] = useState(false);
  const { toast, toastEl } = useToast();
  const decide = useAction(({ id, decision }: any) => post(`/api/finance/transactions/${id}/decision`, { decision }), [["finance"], ["dashboard"]]);
  const w = me.subscription.caps.write;
  const cur = me.tenant.currency;
  return (
    <>
      <PageHeader title="Finanças" subtitle={`Receitas e despesas. Despesas a partir de ${fmtMoney(list.data?.approvalThreshold ?? 500000, cur)} exigem aprovação de outra pessoa.`} actions={can(me, "finance.create") && <Button disabled={!w} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Novo movimento</Button>} />
      {decide.error && <div className="mb-3"><ErrorText error={decide.error} /></div>}
      <DataTable rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<><BranchSelect value={branch} onChange={setBranch} /><Select aria-label="Filtrar estado" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48"><option value="">Todos os estados</option><option value="pending_approval">Por aprovar</option><option value="approved">Aprovados</option><option value="rejected">Rejeitados</option></Select></>}
        columns={[
          { key: "occurredOn", header: "Data", render: (r: any) => fmtDate(r.occurredOn) },
          { key: "kind", header: "Tipo", render: (r: any) => <Badge tone={r.kind === "income" ? "green" : "amber"}>{r.kind === "income" ? "Receita" : "Despesa"}</Badge> },
          { key: "category", header: "Categoria" },
          { key: "description", header: "Descrição", render: (r: any) => r.description || "—" },
          { key: "amount", header: "Valor", render: (r: any) => <strong>{fmtMoney(r.amount, cur)}</strong> },
          { key: "status", header: "Estado", render: (r: any) => <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"}>{{ approved: "Aprovado", rejected: "Rejeitado", pending_approval: "Por aprovar" }[r.status as string]}</Badge> },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => r.status === "pending_approval" && can(me, "finance.approve") && (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" disabled={!w || r.createdBy === me.membership.id} title={r.createdBy === me.membership.id ? "Segregação de funções: não pode aprovar o que registou" : "Aprovar"} onClick={async () => { await decide.mutateAsync({ id: r.id, decision: "approve" }); toast("Despesa aprovada."); }} aria-label="Aprovar"><Check className="h-4 w-4 text-emerald-600" /></Button>
                <Button size="sm" variant="ghost" disabled={!w || r.createdBy === me.membership.id} onClick={async () => { await decide.mutateAsync({ id: r.id, decision: "reject" }); toast("Despesa rejeitada."); }} aria-label="Rejeitar"><X className="h-4 w-4 text-rose-600" /></Button>
              </div>
            ),
          },
        ]} />
      {creating && <FinanceForm onClose={() => setCreating(false)} onSaved={(r) => { setCreating(false); toast(r.status === "pending_approval" ? "Movimento registado — aguarda aprovação." : "Movimento registado."); }} />}
      {toastEl}
    </>
  );
}

function FinanceForm({ onClose, onSaved }: { onClose: () => void; onSaved: (r: any) => void }) {
  const me = useMeCtx();
  const [f, setF] = useState({ kind: "expense", category: "", description: "", amount: 0, occurredOn: new Date().toISOString().slice(0, 10), branchId: me.membership.branchScope?.length === 1 ? me.membership.branchScope[0] : "" });
  const save = useAction((v: any) => post("/api/finance/transactions", v), [["finance"], ["dashboard"]]);
  return (
    <Modal open onClose={onClose} title="Novo movimento financeiro">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); onSaved(await save.mutateAsync({ ...f, amount: +f.amount, branchId: f.branchId || null })); }}>
        {save.error && <ErrorText error={save.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
          <Field label="Data"><Input type="date" required value={f.occurredOn} onChange={(e) => setF({ ...f, occurredOn: e.target.value })} /></Field>
          <Field label="Categoria"><Input required minLength={2} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <Field label="Valor"><Input type="number" min={0.01} step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
        </div>
        <Field label="Descrição"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <BranchField value={f.branchId} onChange={(v) => setF({ ...f, branchId: v })} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Registar</Button></div>
      </form>
    </Modal>
  );
}

/** Campo de unidade para formulários (obrigatório quando o utilizador está restrito a várias unidades). */
function BranchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const me = useMeCtx();
  const branches = useBranches();
  if (!branches.length) return null;
  const scoped = !!me.membership.branchScope;
  return (
    <Field label="Unidade">
      <Select value={value} required={scoped} onChange={(e) => onChange(e.target.value)}>
        <option value="">{scoped ? "Escolher…" : "Sem unidade (empresa)"}</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
      </Select>
    </Field>
  );
}
