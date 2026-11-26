import { useState } from "react";
import { T, useI18n } from "../../lib/i18n";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus, Trash2, Pencil, PackagePlus, Ban, Check, X, Paperclip, ArrowLeftRight } from "lucide-react";
import { DocumentsModal } from "../../components/Documents";
import { ImportModal } from "../../components/Import";
import { BulkDeleteModal } from "../../components/Bulk";
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
  const { lang } = useI18n();
  const en = lang === "en";
  const { data, isLoading, error } = useApi<any>(["dashboard", branch], `/api/dashboard${branch ? `?branchId=${branch}` : ""}`);
  const cur = me.tenant.currency;
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const s = data.sales;
  const delta = s && s.previousMonth ? Math.round(((s.month - s.previousMonth) / s.previousMonth) * 100) : null;
  return (
    <>
      <PageHeader title={`${en ? "Hello" : "Olá"}, ${me.user.name.split(" ")[0]}`} subtitle={en ? `${me.tenant.name} · indicators tailored to your permissions${me.membership.branchScope ? " and branches" : ""}` : `${me.tenant.name} · indicadores adaptados às suas permissões${me.membership.branchScope ? " e unidades" : ""}`} actions={<BranchSelect value={branch} onChange={setBranch} />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {s && <Stat label="Vendas do mês" value={fmtMoney(s.month, cur)} hint={delta !== null ? `${delta >= 0 ? "+" : ""}${delta}% ${en ? "vs full previous month" : "vs mês anterior completo"}` : undefined} tone={delta !== null ? (delta >= 0 ? "up" : "down") : undefined} />}
        {data.finance && <Stat label="Resultado do mês" value={fmtMoney(data.finance.result, cur)} hint={en ? `${data.finance.pendingApprovals} expense(s) pending approval` : `${data.finance.pendingApprovals} despesa(s) por aprovar`} />}
        {data.inventory && <Stat label="Stock baixo" value={fmtNum(data.inventory.lowStock.length)} hint={en ? `of ${data.inventory.products} products` : `de ${data.inventory.products} produtos`} tone={data.inventory.lowStock.length ? "down" : undefined} />}
        {data.customers && <Stat label="Clientes" value={fmtNum(data.customers.total)} />}
        {data.employees && <Stat label="Funcionários ativos" value={fmtNum(data.employees.active)} />}
      </div>
      <Onboarding />
      {!Object.keys(data).length && <Alert><T>O seu perfil ainda não tem acesso a indicadores de negócio. Peça ao administrador as permissões necessárias.</T></Alert>}
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
            {!data.inventory.lowStock.length ? <p className="text-sm muted"><T>Nenhum produto abaixo do nível de reposição.</T></p> : (
              <ul className="space-y-2 text-sm">{data.inventory.lowStock.map((p: any) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><Badge tone="red">{p.stockQty} / {p.reorderLevel}</Badge></li>)}</ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Onboarding() {
  const { lang, tr } = useI18n();
  const { data } = useApi<any>(["onboarding"], "/api/company/onboarding");
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem("nx-onboarding-hidden") === "1"; } catch { return false; } });
  if (!data || hidden || data.completed === data.total) return null;
  return (
    <div className="card mt-6 p-4">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="font-semibold"><T>Primeiros passos</T></h2><p className="text-sm muted">{lang === "en" ? `${data.completed} of ${data.total} done` : `${data.completed} de ${data.total} concluídos`}</p></div>
        <button className="text-xs muted underline" onClick={() => { setHidden(true); try { localStorage.setItem("nx-onboarding-hidden", "1"); } catch {} }}><T>Ocultar</T></button>
      </div>
      <div className="mt-2 h-1.5 rounded bg-slate-200 dark:bg-slate-800"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${(data.completed / data.total) * 100}%` }} /></div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.steps.map((s: any) => (
          <li key={s.key}><a href={s.link} className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${s.done ? "bg-emerald-500 text-white" : "border border-slate-300 dark:border-slate-600"}`}>{s.done ? "✓" : ""}</span>
            <span className={s.done ? "muted line-through" : ""}>{tr(s.label)}</span>
          </a></li>
        ))}
      </ul>
    </div>
  );
}

/* ============================== Clientes ============================== */
export function Customers() {
  const me = useMeCtx();
  const { tr } = useI18n();
  const list = useList("customers", "/api/crm/customers");
  const [edit, setEdit] = useState<any | null>(null);
  const [docs, setDocs] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const remove = useAction((id: string) => del(`/api/crm/customers/${id}`), [["customers"]]);
  const w = me.subscription.caps.write;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const canBulk = can(me, "crm.delete") && w;
  return (
    <>
      {bulk && <BulkDeleteModal endpoint="/api/crm/customers/bulk-delete" ids={[...sel]} invalidate={[["customers"]]} onClose={() => setBulk(false)} onDone={(n) => { setBulk(false); setSel(new Set()); toast(`${n} ${tr("movido(s) para a lixeira.")}`); }} />}
      <PageHeader title="Clientes" subtitle="Cadastro e contactos comerciais." actions={can(me, "crm.create") && <><Button variant="secondary" disabled={!w} onClick={() => setImporting(true)}>Importar CSV</Button><Button disabled={!w} onClick={() => setEdit({})}><Plus className="h-4 w-4" /> <T>Novo cliente</T></Button></>} />
      <DataTable
        rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error}
        search={list.q} onSearch={list.setQ} sort={list.sort} onSort={list.onSort}
        {...(canBulk ? { selected: sel, onSelect: setSel } : {})}
        toolbar={canBulk && sel.size > 0 && <Button size="sm" variant="danger" onClick={() => setBulk(true)}><Trash2 className="h-4 w-4" /> {tr("Eliminar selecionados")} ({sel.size})</Button>}
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
                {can(me, "crm.delete") && <Button size="sm" variant="ghost" disabled={!w} aria-label={`Eliminar ${r.name}`} onClick={async () => { if (await confirm("Eliminar cliente", <>O cliente <strong>{r.name}</strong> <T>vai para a lixeira e pode ser restaurado durante 30 dias.</T></>)) { await remove.mutateAsync(r.id); toast("Cliente movido para a lixeira."); } }}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ),
          },
        ]}
      />
      {importing && <ImportModal dataset="customers" onClose={() => setImporting(false)} onDone={(n) => { setImporting(false); toast(`${n} ✓`); }} />}
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
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button loading={save.isPending}><T>Guardar</T></Button></div>
      </form>
    </Modal>
  );
}

/* ============================== Stock ============================== */
export function Products() {
  const me = useMeCtx();
  const [params] = useSearchParams();
  const [low, setLow] = useState(params.get("lowStock") === "1");
  const [tab, setTab] = useState(params.get("tab") === "transfers" ? "transfers" : "products");
  const list = useList("products", "/api/inventory/products", low ? { lowStock: "true" } : {});
  const { tr } = useI18n();
  // Previsão de rutura (vendas dos últimos 90 dias), por SKU
  const forecast = useApi<any>(["stock-forecast"], "/api/inventory/stock-forecast");
  const cover = new Map<string, any>((forecast.data?.items ?? []).map((i: any) => [i.sku, i]));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [adjust, setAdjust] = useState<any | null>(null);
  const [transfer, setTransfer] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const branches = useBranches();
  const bName = (id: string) => branches.find((b) => b.id === id)?.code ?? "?";
  const [showMoves, setShowMoves] = useState(false);
  const { confirm, dialog } = useConfirm();
  const { toast, toastEl } = useToast();
  const remove = useAction((id: string) => del(`/api/inventory/products/${id}`), [["products"]]);
  const w = me.subscription.caps.write;
  const canBulk = can(me, "inventory.delete") && w;
  const cur = me.tenant.currency;
  return (
    <>
      {bulk && <BulkDeleteModal endpoint="/api/inventory/products/bulk-delete" ids={[...sel]} invalidate={[["products"], ["stock-forecast"]]} onClose={() => setBulk(false)} onDone={(n) => { setBulk(false); setSel(new Set()); toast(`${n} ${tr("movido(s) para a lixeira.")}`); }} />}
      <PageHeader title="Stock e inventário" subtitle="Produtos, níveis de stock e ajustes rastreáveis." actions={<>
        <Button variant="secondary" onClick={() => setShowMoves(true)}><T>Movimentos</T></Button>
        {can(me, "inventory.create") && <Button variant="secondary" disabled={!w} onClick={() => setImporting(true)}>Importar CSV</Button>}
        {can(me, "inventory.create") && <Button disabled={!w} onClick={() => setEdit({})}><Plus className="h-4 w-4" /> <T>Novo produto</T></Button>}
      </>} />
      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
        {[["products", "Produtos"], ["transfers", "Guias de transferência"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-600 font-medium text-brand-700 dark:text-brand-100" : "border-transparent muted"}`}><T>{l}</T></button>
        ))}
      </div>
      {tab === "transfers" ? <TransferOrders /> : <DataTable sort={list.sort} onSort={list.onSort}
        rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        {...(canBulk ? { selected: sel, onSelect: setSel } : {})}
        toolbar={<>
          {canBulk && sel.size > 0 && <Button size="sm" variant="danger" onClick={() => setBulk(true)}><Trash2 className="h-4 w-4" /> {tr("Eliminar selecionados")} ({sel.size})</Button>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} /> <T>Só stock baixo</T></label>
        </>}
        columns={[
          { key: "sku", header: "SKU", sortable: true },
          { key: "name", header: "Produto", sortable: true, render: (r: any) => <span className="font-medium">{r.name}</span> },
          { key: "unitPrice", header: "Preço", sortable: true, render: (r: any) => fmtMoney(r.unitPrice, cur) },
          { key: "stockQty", header: "Stock", sortable: true, render: (r: any) => (
            <div>
              <Badge tone={r.stockQty <= r.reorderLevel ? "red" : "green"}>{fmtNum(r.stockQty)}</Badge>
              {(r.levels?.length > 0 || branches.length > 0) && (
                <p className="mt-1 text-xs muted">
                  {!me.membership.branchScope && <>Central {fmtNum(r.centralQty)}</>}
                  {r.levels.filter((l: any) => l.qty !== 0).map((l: any) => <span key={l.branchId}> · {bName(l.branchId)} {fmtNum(l.qty)}</span>)}
                  {r.inTransit > 0 && <span className="text-amber-700 dark:text-amber-400"> · <T>em trânsito</T> {fmtNum(r.inTransit)}</span>}
                </p>
              )}
              {cover.get(r.sku)?.daysOfCover != null && cover.get(r.sku).daysOfCover <= 60 && (
                <p className={`mt-1 text-xs ${cover.get(r.sku).daysOfCover <= 14 ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"}`} title={tr("Estimativa a partir das vendas dos últimos 90 dias; não é uma certeza.")}>
                  {tr("esgota em")} ~{cover.get(r.sku).daysOfCover} {tr("dias")}
                </p>
              )}
            </div>
          ) },
          { key: "reorderLevel", header: "Repor a", sortable: true, render: (r: any) => fmtNum(r.reorderLevel) },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => (
              <div className="flex justify-end gap-1">
                {can(me, "inventory.adjust") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setAdjust(r)} aria-label={`Ajustar stock de ${r.name}`}><PackagePlus className="h-4 w-4" /></Button>}
                {can(me, "inventory.approve_transfer") && branches.length > 0 && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setTransfer(r)} aria-label={`Transferir stock de ${r.name}`}><ArrowLeftRight className="h-4 w-4" /></Button>}
                {can(me, "inventory.edit") && <Button size="sm" variant="ghost" disabled={!w} onClick={() => setEdit(r)} aria-label={`Editar ${r.name}`}><Pencil className="h-4 w-4" /></Button>}
                {can(me, "inventory.delete") && <Button size="sm" variant="ghost" disabled={!w} aria-label={`Eliminar ${r.name}`} onClick={async () => { if (await confirm("Eliminar produto", `${r.sku} vai para a lixeira (recuperável durante 30 dias).`)) { await remove.mutateAsync(r.id); toast("Produto movido para a lixeira."); } }}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ),
          },
        ]}
      />}
      <ProductForm value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast("Produto guardado."); }} />
      <AdjustForm value={adjust} onClose={() => setAdjust(null)} onSaved={() => { setAdjust(null); toast("Stock ajustado."); }} />
      {importing && <ImportModal dataset="products" onClose={() => setImporting(false)} onDone={(n) => { setImporting(false); toast(`${n} ✓`); }} />}
      {transfer && <TransferForm product={transfer} onClose={() => setTransfer(null)} onSaved={() => { setTransfer(null); toast("Transferência registada."); }} />}
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
        { key: "delta", header: "Qtd", render: (r: any) => <span className={r.delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>{r.delta > 0 ? "+" : ""}{r.delta}</span> },
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
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button loading={save.isPending}><T>Guardar</T></Button></div>
      </form>
    </Modal>
  );
}

/** Localizações onde o utilizador pode movimentar stock: central (se não restrito) e unidades. */
function useLocations() {
  const me = useMeCtx();
  const branches = useBranches();
  return [...(me.membership.branchScope ? [] : [{ id: "", label: "Armazém central" }]), ...branches.map((b) => ({ id: b.id, label: `${b.name} (${b.code})` }))];
}
const qtyAt = (p: any, loc: string) => (loc ? p?.levels?.find((l: any) => l.branchId === loc)?.qty ?? 0 : p?.centralQty ?? 0);

function TransferForm({ product, onClose, onSaved }: { product: any; onClose: () => void; onSaved: () => void }) {
  const locs = useLocations();
  const [from, setFrom] = useState(locs[0]?.id ?? "");
  const [to, setTo] = useState(locs[1]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const save = useAction((v: any) => post("/api/inventory/transfers", v), [["products"], ["movements"]]);
  return (
    <Modal open onClose={onClose} title={`Transferência imediata · ${product.name}`}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ productId: product.id, fromBranchId: from || null, toBranchId: to || null, quantity: qty, reason }); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Origem (disponível: ${qtyAt(product, from)})`}><Select value={from} onChange={(e) => setFrom(e.target.value)}>{locs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
          <Field label="Destino"><Select value={to} onChange={(e) => setTo(e.target.value)}>{locs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
        </div>
        <Field label="Quantidade"><Input type="number" min={1} max={qtyAt(product, from)} required value={qty} onChange={(e) => setQty(+e.target.value)} /></Field>
        <Field label="Motivo"><Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Abastecimento, reposição…" /></Field>
        <p className="text-xs muted"><T>O total da empresa não muda; só a localização do stock.</T></p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button disabled={from === to} loading={save.isPending}><T>Transferir</T></Button></div>
      </form>
    </Modal>
  );
}

function AdjustForm({ value, onClose, onSaved }: { value: any | null; onClose: () => void; onSaved: () => void }) {
  const locs = useLocations();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [loc, setLoc] = useState<string | null>(null);
  const where = loc ?? locs[0]?.id ?? "";
  const save = useAction((v: any) => post(`/api/inventory/products/${value.id}/adjust`, v), [["products"], ["dashboard"], ["movements"]]);
  return (
    <Modal open={value !== null} onClose={onClose} title={`Ajustar stock · ${value?.name ?? ""}`}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ delta: +delta, reason, branchId: where || null }); setDelta(0); setReason(""); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        {locs.length > 1 && <Field label="Localização"><Select value={where} onChange={(e) => setLoc(e.target.value)}>{locs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>}
        <p className="text-sm"><T>Stock nesta localização:</T> <strong>{qtyAt(value, where)}</strong> <T>→ depois do ajuste:</T> <strong>{qtyAt(value, where) + Number(delta || 0)}</strong></p>
        <Field label="Quantidade (+ entrada / − saída)"><Input type="number" required value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></Field>
        <Field label="Motivo"><Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Inventário, quebra, devolução…" /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button loading={save.isPending}><T>Confirmar ajuste</T></Button></div>
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
      <PageHeader title="Vendas" subtitle="Cada venda dá baixa de stock automaticamente, numa única transação." actions={can(me, "sales.create") && <Button disabled={!w} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> <T>Nova venda</T></Button>} />
      <DataTable sort={list.sort} onSort={list.onSort} rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<BranchSelect value={branch} onChange={setBranch} />}
        columns={[
          ...(branches.length ? [{ key: "branch", header: "Unidade", render: (r: any) => branches.find((b) => b.id === r.branchId)?.name ?? "—" }] : []),
          { key: "number", header: "N.º", sortable: true, render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
          { key: "soldAt", header: "Data", sortable: true, render: (r: any) => fmtDate(r.soldAt) },
          { key: "customer", header: "Cliente", sortable: true, render: (r: any) => r.customer ?? "Consumidor final" },
          { key: "lines", header: "Itens", render: (r: any) => r.lines.map((l: any) => `${l.quantity}× ${l.name}`).join(", ") },
          { key: "total", header: "Total", sortable: true, render: (r: any) => <strong>{fmtMoney(r.total, cur)}</strong> },
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
            <Field label={i === 0 ? "Produto" : ""}><Select required value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}><option value="">Escolher…</option>{items.map((p: any) => { const q = qtyAt(p, branchId); return <option key={p.id} value={p.id} disabled={q <= 0}>{p.sku} · {p.name} ({q} {branchId ? "na unidade" : "no central"})</option>; })}</Select></Field>
            <Field label={i === 0 ? "Qtd" : ""}><Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, +e.target.value) } : x)))} /></Field>
            <Button type="button" variant="ghost" aria-label="Remover linha" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, { productId: "", quantity: 1 }])}><Plus className="h-4 w-4" /> <T>Linha</T></Button>
        <p className="text-right text-lg font-semibold">Total: {fmtMoney(total, me.tenant.currency)}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button loading={save.isPending}><T>Registar venda</T></Button></div>
      </form>
    </Modal>
  );
}

/* ============================== Finanças ============================== */
/** Previsão de tesouraria (spec 9.8): estimativa com intervalo, pressupostos e limitações — nunca uma certeza. */
function CashflowForecast({ currency }: { currency: string }) {
  const { tr } = useI18n();
  const { data, isLoading } = useApi<any>(["cashflow-forecast"], "/api/finance/cashflow-forecast");
  if (isLoading || !data) return null;
  return (
    <details className="card mb-4 p-4">
      <summary className="cursor-pointer text-sm font-semibold"><T>Previsão de tesouraria</T></summary>
      {!data.sufficientData ? (
        <p className="mt-2 text-sm muted"><T>Histórico financeiro insuficiente para prever (são precisos pelo menos 3 meses com movimentos aprovados).</T></p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase muted"><th className="py-1 pr-4"><T>Mês</T></th><th className="pr-4"><T>Receitas</T></th><th className="pr-4"><T>Despesas</T></th><th><T>Saldo estimado (intervalo de 80%)</T></th></tr></thead>
              <tbody>
                {data.net.map((n: any, i: number) => (
                  <tr key={n.period} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-4 font-mono text-xs">{n.period}</td>
                    <td className="pr-4">~{fmtMoney(data.income[i].value, currency)}</td>
                    <td className="pr-4">~{fmtMoney(data.expense[i].value, currency)}</td>
                    <td><strong className={n.value < 0 ? "text-rose-600 dark:text-rose-400" : ""}>~{fmtMoney(n.value, currency)}</strong> <span className="text-xs muted">({fmtMoney(n.low, currency)} – {fmtMoney(n.high, currency)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs muted">{tr("Método")}: {tr(data.method)}. {tr("Limitações")}: {data.limitations.map((l: string) => tr(l)).join(" ")}</p>
        </>
      )}
    </details>
  );
}

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
      <PageHeader title="Finanças" subtitle={`Receitas e despesas. Despesas a partir de ${fmtMoney(list.data?.approvalThreshold ?? 500000, cur)} exigem aprovação de outra pessoa.`} actions={can(me, "finance.create") && <Button disabled={!w} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> <T>Novo movimento</T></Button>} />
      {decide.error && <div className="mb-3"><ErrorText error={decide.error} /></div>}
      <CashflowForecast currency={cur} />
      <DataTable sort={list.sort} onSort={list.onSort} rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error} search={list.q} onSearch={list.setQ}
        toolbar={<><BranchSelect value={branch} onChange={setBranch} /><Select aria-label="Filtrar estado" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48"><option value="">Todos os estados</option><option value="pending_approval">Por aprovar</option><option value="approved">Aprovados</option><option value="rejected">Rejeitados</option></Select></>}
        columns={[
          { key: "occurredOn", header: "Data", sortable: true, render: (r: any) => fmtDate(r.occurredOn) },
          { key: "kind", header: "Tipo", sortable: true, render: (r: any) => <Badge tone={r.kind === "income" ? "green" : "amber"}>{r.kind === "income" ? "Receita" : "Despesa"}</Badge> },
          { key: "category", header: "Categoria", sortable: true },
          { key: "description", header: "Descrição", render: (r: any) => r.description || "—" },
          { key: "amount", header: "Valor", sortable: true, render: (r: any) => <strong>{fmtMoney(r.amount, cur)}</strong> },
          { key: "status", header: "Estado", render: (r: any) => <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"}>{{ approved: "Aprovado", rejected: "Rejeitado", pending_approval: "Por aprovar" }[r.status as string]}</Badge> },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => r.status === "pending_approval" && can(me, "finance.approve") && (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" disabled={!w || r.createdBy === me.membership.id} title={r.createdBy === me.membership.id ? "Segregação de funções: não pode aprovar o que registou" : "Aprovar"} onClick={async () => { await decide.mutateAsync({ id: r.id, decision: "approve" }); toast("Despesa aprovada."); }} aria-label="Aprovar"><Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /></Button>
                <Button size="sm" variant="ghost" disabled={!w || r.createdBy === me.membership.id} onClick={async () => { await decide.mutateAsync({ id: r.id, decision: "reject" }); toast("Despesa rejeitada."); }} aria-label="Rejeitar"><X className="h-4 w-4 text-rose-600 dark:text-rose-400" /></Button>
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
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}><T>Cancelar</T></Button><Button loading={save.isPending}><T>Registar</T></Button></div>
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

/* ============================== Guias de transferência ============================== */
const TR_STATUS: Record<string, [string, "amber" | "blue" | "green" | "red" | "gray"]> = {
  requested: ["Pedida", "amber"], in_transit: ["Em trânsito", "blue"], received: ["Recebida", "green"], rejected: ["Rejeitada", "red"], canceled: ["Cancelada", "gray"],
};

function TransferOrders() {
  const me = useMeCtx();
  const [status, setStatus] = useState("");
  const list = useList("transfer-orders", "/api/inventory/transfer-orders", status ? { status } : {});
  const branches = useBranches();
  const allBranches = useApi<any[]>(["branches"], "/api/company/branches");
  const [creating, setCreating] = useState(false);
  const [reject, setReject] = useState<any | null>(null);
  const [receiving, setReceiving] = useState<any | null>(null);
  const { toast, toastEl } = useToast();
  const act = useAction(({ id, action, body }: any) => post(`/api/inventory/transfer-orders/${id}/${action}`, body ?? {}), [["transfer-orders"], ["products"], ["movements"]]);
  const w = me.subscription.caps.write;
  const loc = (id: string | null) => (id ? allBranches.data?.find((b) => b.id === id)?.name ?? "—" : "Armazém central");
  const scoped = (id: string | null) => !me.membership.branchScope || (!!id && me.membership.branchScope.includes(id));
  return (
    <>
      {act.error && <div className="mb-3"><ErrorText error={act.error} /></div>}
      <DataTable rows={list.data?.items} total={list.data?.total} page={list.page} pageSize={20} onPage={list.setPage} loading={list.isLoading} error={list.error}
        toolbar={<>
          <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44"><option value="">Todos os estados</option>{Object.entries(TR_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</Select>
          {can(me, "inventory.adjust") && branches.length > 0 && <Button disabled={!w} onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> <T>Nova guia</T></Button>}
        </>}
        columns={[
          { key: "number", header: "N.º", render: (r: any) => <span className="font-mono text-xs">{r.number}</span> },
          { key: "createdAt", header: "Data", render: (r: any) => fmtDate(r.createdAt) },
          { key: "route", header: "Percurso", render: (r: any) => <span>{loc(r.fromBranchId)} → {loc(r.toBranchId)}</span> },
          { key: "lines", header: "Itens", render: (r: any) => r.lines.map((l: any) => (l.received !== undefined && l.received < l.quantity ? `${l.received}/${l.quantity}× ${l.name}` : `${l.quantity}× ${l.name}`)).join(", ") },
          { key: "status", header: "Estado", render: (r: any) => {
            const short = r.status === "received" && r.lines.some((l: any) => l.received !== undefined && l.received < l.quantity);
            return <span title={short ? r.receiptNote : undefined}><Badge tone={short ? "amber" : TR_STATUS[r.status][1]}>{short ? "Recebida com diferenças" : TR_STATUS[r.status][0]}</Badge></span>;
          } },
          {
            key: "a", header: "", className: "text-right", render: (r: any) => (
              <div className="flex flex-wrap justify-end gap-1">
                <a className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" href={`/api/inventory/transfer-orders/${r.id}/guide`}>PDF</a>
                {r.status === "requested" && can(me, "inventory.approve_transfer") && r.requestedBy !== me.membership.id && scoped(r.fromBranchId) && <>
                  <Button size="sm" disabled={!w} onClick={async () => { await act.mutateAsync({ id: r.id, action: "approve" }); toast("Guia expedida."); }}>Aprovar e expedir</Button>
                  <Button size="sm" variant="secondary" disabled={!w} onClick={() => setReject(r)}>Rejeitar</Button>
                </>}
                {r.status === "requested" && r.requestedBy === me.membership.id && <Button size="sm" variant="ghost" disabled={!w} onClick={() => act.mutate({ id: r.id, action: "cancel" })}>Cancelar</Button>}
                {r.status === "in_transit" && can(me, "inventory.adjust") && scoped(r.toBranchId) && <Button size="sm" disabled={!w} onClick={() => setReceiving(r)}>Confirmar receção</Button>}
              </div>
            ),
          },
        ]} />
      {creating && <TransferOrderForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); toast("Guia pedida — aguarda aprovação."); }} />}
      {receiving && <ReceiveForm order={receiving} onClose={() => setReceiving(null)} onSaved={(short) => { setReceiving(null); toast(short ? "Guia recebida com diferenças." : "Guia recebida."); }} />}
      {reject && (
        <Modal open onClose={() => setReject(null)} title={`Rejeitar ${reject.number}`}>
          <RejectForm onCancel={() => setReject(null)} onConfirm={async (note) => { await act.mutateAsync({ id: reject.id, action: "reject", body: { note } }); setReject(null); }} />
        </Modal>
      )}
      {toastEl}
    </>
  );
}

/** Receção: quantidade recebida por linha (por omissão, tudo); faltas exigem motivo. */
function ReceiveForm({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: (short: boolean) => void }) {
  const [got, setGot] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l: any) => [l.productId, l.quantity])));
  const [note, setNote] = useState("");
  const save = useAction((v: any) => post(`/api/inventory/transfer-orders/${order.id}/receive`, v), [["transfer-orders"], ["products"], ["movements"], ["stock-forecast"]]);
  const short = order.lines.some((l: any) => got[l.productId] < l.quantity);
  return (
    <Modal open onClose={onClose} title={`Receção · ${order.number}`}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ lines: order.lines.map((l: any) => ({ productId: l.productId, received: got[l.productId] })), note: note || undefined }); onSaved(short); }}>
        {save.error && <ErrorText error={save.error} />}
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase muted"><th className="py-1"><T>Produto</T></th><th><T>Expedida</T></th><th><T>Recebida</T></th></tr></thead>
          <tbody>
            {order.lines.map((l: any) => (
              <tr key={l.productId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5">{l.sku} · {l.name}</td>
                <td>{l.quantity}</td>
                <td><Input type="number" min={0} max={l.quantity} className="w-24" aria-label={`Recebida ${l.sku}`} value={got[l.productId]} onChange={(e) => setGot({ ...got, [l.productId]: Math.min(l.quantity, Math.max(0, Math.floor(+e.target.value || 0))) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {short && (
          <>
            <Alert tone="warning"><T>A diferença fica registada como perda em trânsito: saiu da origem na expedição e não entra no destino. Quem aprova transferências é avisado.</T></Alert>
            <Field label="Motivo da diferença"><Input required minLength={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: caixas danificadas no transporte" /></Field>
          </>
        )}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={save.isPending}>Confirmar receção</Button></div>
      </form>
    </Modal>
  );
}

function RejectForm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <Field label="Motivo"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button variant="danger" disabled={note.trim().length < 3} onClick={() => onConfirm(note)}>Rejeitar</Button></div>
    </div>
  );
}

function TransferOrderForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const me = useMeCtx();
  const branches = useBranches();
  const all = useApi<any[]>(["branches"], "/api/company/branches");
  const prods = useApi<any>(["products-all"], "/api/inventory/products?pageSize=100");
  // Origem/destino possíveis: central (se não restrito) + unidades ativas (qualquer unidade pode ser o "outro lado")
  const everywhere = [{ id: "", label: "Armazém central" }, ...(all.data ?? []).filter((b) => b.isActive).map((b) => ({ id: b.id, label: `${b.name} (${b.code})` }))];
  const [from, setFrom] = useState(me.membership.branchScope ? "" : "");
  const [to, setTo] = useState(me.membership.branchScope?.[0] ?? branches[0]?.id ?? "");
  const [lines, setLines] = useState([{ productId: "", quantity: 1 }]);
  const [reason, setReason] = useState("");
  const [carrier, setCarrier] = useState("");
  const save = useAction((v: any) => post("/api/inventory/transfer-orders", v), [["transfer-orders"]]);
  const items = prods.data?.items ?? [];
  return (
    <Modal open onClose={onClose} title="Nova guia de transferência" wide>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); await save.mutateAsync({ fromBranchId: from || null, toBranchId: to || null, lines: lines.filter((l) => l.productId), reason, carrier: carrier || undefined }); onSaved(); }}>
        {save.error && <ErrorText error={save.error} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Origem"><Select value={from} onChange={(e) => setFrom(e.target.value)}>{everywhere.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
          <Field label="Destino"><Select value={to} onChange={(e) => setTo(e.target.value)}>{everywhere.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
            <Field label={i === 0 ? "Produto" : ""}><Select required value={l.productId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))}><option value="">Escolher…</option>{items.map((p: any) => { const q = qtyAt(p, from); return <option key={p.id} value={p.id} disabled={q <= 0}>{p.sku} · {p.name} ({q})</option>; })}</Select></Field>
            <Field label={i === 0 ? "Qtd" : ""}><Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, +e.target.value) } : x)))} /></Field>
            <Button type="button" variant="ghost" aria-label="Remover linha" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, { productId: "", quantity: 1 }])}><Plus className="h-4 w-4" /> <T>Linha</T></Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Motivo"><Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Abastecimento, reposição…" /></Field>
          <Field label="Transportador (opcional)"><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} /></Field>
        </div>
        <p className="text-xs muted"><T>A guia segue para aprovação por outra pessoa. Ao ser aprovada, o stock sai da origem e fica em trânsito até ser confirmada a receção no destino.</T></p>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={from === to} loading={save.isPending}>Pedir transferência</Button></div>
      </form>
    </Modal>
  );
}
