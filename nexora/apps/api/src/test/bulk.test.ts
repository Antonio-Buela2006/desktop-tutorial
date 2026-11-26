/** Eliminação em lote com pré-visualização: simulação, bloqueios, avisos, aplicação e isolamento. */
import { describe, expect, it } from "vitest";
import { addMember, signupCompany } from "./helpers.js";

describe("eliminação em lote", () => {
  it("produtos: a simulação não altera nada; produtos em guias por concluir são bloqueados", async () => {
    const t = await signupCompany({ plan: "professional" });
    const lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
    const a = (await t.client.post("/api/inventory/products", { sku: "BULK-A", name: "Lote A", unitPrice: 1, initialStock: 5 })).body.id;
    const b = (await t.client.post("/api/inventory/products", { sku: "BULK-B", name: "Lote B", unitPrice: 1 })).body.id;
    const c = (await t.client.post("/api/inventory/products", { sku: "BULK-C", name: "Lote C", unitPrice: 1, initialStock: 3 })).body.id;
    const order = (await t.client.post("/api/inventory/transfer-orders", { fromBranchId: null, toBranchId: lda, lines: [{ productId: c, quantity: 1 }], reason: "Teste" })).body;
    const ghost = "00000000-0000-4000-8000-000000000001";

    const preview = await t.client.post("/api/inventory/products/bulk-delete", { ids: [a, b, c, ghost, a] });
    expect(preview.status).toBe(200);
    expect(preview.body.dryRun).toBe(true);
    expect(preview.body.applied).toBe(0);
    const by = Object.fromEntries(preview.body.items.map((i: any) => [i.id, i]));
    expect(preview.body.items).toHaveLength(4); // ids repetidos contam uma vez
    expect(by[a]).toMatchObject({ status: "ok", warnings: [{ code: "HAS_STOCK", qty: 5 }] });
    expect(by[b]).toMatchObject({ status: "ok", warnings: [] });
    expect(by[c]).toMatchObject({ status: "blocked", reason: { code: "IN_OPEN_TRANSFER", orders: [order.number] } });
    expect(by[ghost].status).toBe("not_found");
    expect((await t.client.get("/api/inventory/products?q=Lote")).body.items).toHaveLength(3); // nada mudou

    const run = await t.client.post("/api/inventory/products/bulk-delete", { ids: [a, b, c], dryRun: false });
    expect(run.body.applied).toBe(2);
    expect((await t.client.get("/api/inventory/products?q=Lote")).body.items.map((p: any) => p.sku)).toEqual(["BULK-C"]);
    // a eliminação individual também respeita o bloqueio
    const single = await t.client.del(`/api/inventory/products/${c}`);
    expect(single.status).toBe(409);
    expect(single.body.error.code).toBe("PRODUCT_IN_OPEN_TRANSFER");
    // vão para a lixeira (recuperáveis) e ficam auditados um a um
    const audit = (await t.client.get("/api/audit?pageSize=50")).body.items.filter((e: any) => e.action === "product.deleted");
    expect(audit.map((e: any) => e.entityId).sort()).toEqual([a, b].sort());
  });

  it("clientes: aviso de compras recentes; permissões e isolamento entre empresas", async () => {
    const t = await signupCompany({ plan: "professional", modules: ["crm", "inventory", "sales"] });
    const c1 = (await t.client.post("/api/crm/customers", { name: "Lote Cliente 1" })).body.id;
    const c2 = (await t.client.post("/api/crm/customers", { name: "Lote Cliente 2" })).body.id;
    const p = (await t.client.post("/api/inventory/products", { sku: "BULK-S", name: "Venda", unitPrice: 10, initialStock: 5 })).body.id;
    expect((await t.client.post("/api/sales/orders", { customerId: c1, lines: [{ productId: p, quantity: 1 }] })).status).toBe(200);
    const pv = await t.client.post("/api/crm/customers/bulk-delete", { ids: [c1, c2] });
    const by = Object.fromEntries(pv.body.items.map((i: any) => [i.id, i]));
    expect(by[c1].warnings).toEqual([{ code: "RECENT_SALES" }]);
    expect(by[c2].warnings).toEqual([]);
    // sem permissão de eliminar
    const seller = await addMember(t.client, ["vendedor"]);
    expect((await seller.client.post("/api/crm/customers/bulk-delete", { ids: [c1] })).status).toBe(403);
    // outra empresa não vê nem elimina estes registos
    const other = await signupCompany();
    const o = await other.client.post("/api/crm/customers/bulk-delete", { ids: [c1, c2], dryRun: false });
    expect(o.body.applied).toBe(0);
    expect(o.body.items.every((i: any) => i.status === "not_found" && i.label === null)).toBe(true);
    expect((await t.client.post("/api/crm/customers/bulk-delete", { ids: [c1, c2], dryRun: false })).body.applied).toBe(2);
    // limites
    expect((await t.client.post("/api/crm/customers/bulk-delete", { ids: [] })).status).toBe(400);
    expect((await t.client.post("/api/crm/customers/bulk-delete", { ids: Array.from({ length: 101 }, () => c1) })).status).toBe(400);
  });
});
