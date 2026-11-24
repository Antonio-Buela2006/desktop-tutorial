/** Guias de transferência: pedido → aprovação/expedição (segregação) → receção; trânsito; PDF; âmbito. */
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, getApp, signupCompany } from "./helpers.js";
import { db } from "../db/client.js";
import { roles } from "../db/schema.js";
import { and, eq } from "drizzle-orm";

let t: Awaited<ReturnType<typeof signupCompany>>;
let lda: string;
let bgl: string;
let prod: string;

async function product() {
  const r = await t.client.get("/api/inventory/products?q=GT-P&pageSize=10");
  return r.body.items[0];
}
const lvl = (p: any, b: string) => p.levels.find((l: any) => l.branchId === b)?.qty ?? 0;

beforeAll(async () => {
  t = await signupCompany({ plan: "professional" });
  lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
  bgl = (await t.client.post("/api/company/branches", { code: "BGL", name: "Benguela" })).body.id;
  prod = (await t.client.post("/api/inventory/products", { sku: "GT-P1", name: "Produto Guia", unitPrice: 100, initialStock: 50 })).body.id;
});

describe("guias de transferência", () => {
  it("as funções predefinidas das empresas recebem a nova permissão", async () => {
    const [r] = await db.select().from(roles).where(and(eq(roles.tenantId, t.tenantId), eq(roles.code, "gestor_stock")));
    expect(r.permissions).toContain("inventory.approve_transfer");
  });

  it("ciclo completo com segregação de funções, trânsito e receção", async () => {
    const order = await t.client.post("/api/inventory/transfer-orders", { fromBranchId: null, toBranchId: lda, lines: [{ productId: prod, quantity: 20 }], reason: "Abastecer Luanda" });
    expect(order.status).toBe(200);
    expect(order.body).toMatchObject({ status: "requested", number: "GT-00001" });
    // quem pede não aprova
    const self = await t.client.post(`/api/inventory/transfer-orders/${order.body.id}/approve`, {});
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe("SEGREGATION_OF_DUTIES");
    const mgr = await addMember(t.client, ["gestor_stock"]);
    const ok = await mgr.client.post(`/api/inventory/transfer-orders/${order.body.id}/approve`, { carrier: "Transportes Kwanza" });
    expect(ok.body.status).toBe("in_transit");
    let p = await product();
    expect(p.centralQty).toBe(30);
    expect(p.inTransit).toBe(20);
    expect(p.stockQty).toBe(30);
    expect((await mgr.client.post(`/api/inventory/transfer-orders/${order.body.id}/approve`, {})).status).toBe(409);
    // receção
    const rec = await t.client.post(`/api/inventory/transfer-orders/${order.body.id}/receive`, {});
    expect(rec.body.status).toBe("received");
    p = await product();
    expect(lvl(p, lda)).toBe(20);
    expect(p.inTransit).toBe(0);
    expect(p.stockQty).toBe(50);
    expect((await t.client.post(`/api/inventory/transfer-orders/${order.body.id}/receive`, {})).status).toBe(409);
    // guia em PDF
    const app = await getApp();
    const pdf = await app.inject({ method: "GET", url: `/api/inventory/transfer-orders/${order.body.id}/guide`, headers: { cookie: t.client.cookie } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("não expede mais do que existe na origem; rejeição e cancelamento", async () => {
    const big = await t.client.post("/api/inventory/transfer-orders", { fromBranchId: lda, toBranchId: bgl, lines: [{ productId: prod, quantity: 999 }], reason: "Excesso" });
    const mgr = await addMember(t.client, ["gestor_stock"]);
    const r = await mgr.client.post(`/api/inventory/transfer-orders/${big.body.id}/approve`, {});
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("INSUFFICIENT_STOCK");
    // falhou dentro da transação: a guia continua pedida
    const list = await t.client.get("/api/inventory/transfer-orders?status=requested");
    expect(list.body.items.some((x: any) => x.id === big.body.id)).toBe(true);
    expect((await mgr.client.post(`/api/inventory/transfer-orders/${big.body.id}/reject`, { note: "Quantidade excessiva" })).body.status).toBe("rejected");
    const c = await t.client.post("/api/inventory/transfer-orders", { fromBranchId: lda, toBranchId: bgl, lines: [{ productId: prod, quantity: 1 }], reason: "Teste" });
    expect((await mgr.client.post(`/api/inventory/transfer-orders/${c.body.id}/cancel`, {})).status).toBe(403);
    expect((await t.client.post(`/api/inventory/transfer-orders/${c.body.id}/cancel`, {})).body.status).toBe("canceled");
  });

  it("âmbito por unidade e isolamento entre empresas", async () => {
    const order = await t.client.post("/api/inventory/transfer-orders", { fromBranchId: lda, toBranchId: bgl, lines: [{ productId: prod, quantity: 5 }], reason: "Para Benguela" });
    const mgr = await addMember(t.client, ["gestor_stock"]);
    await t.client.put(`/api/company/users/${mgr.membershipId}/branches`, { branchIds: [bgl] });
    // a origem (Luanda) não é do âmbito do gestor de Benguela
    expect((await mgr.client.post(`/api/inventory/transfer-orders/${order.body.id}/approve`, {})).status).toBe(403);
    const mgrLda = await addMember(t.client, ["gestor_stock"]);
    await t.client.put(`/api/company/users/${mgrLda.membershipId}/branches`, { branchIds: [lda] });
    expect((await mgrLda.client.post(`/api/inventory/transfer-orders/${order.body.id}/approve`, {})).body.status).toBe("in_transit");
    // só o destino recebe
    expect((await mgrLda.client.post(`/api/inventory/transfer-orders/${order.body.id}/receive`, {})).status).toBe(403);
    expect((await mgr.client.post(`/api/inventory/transfer-orders/${order.body.id}/receive`, {})).body.status).toBe("received");
    const other = await signupCompany();
    expect((await other.client.get(`/api/inventory/transfer-orders/${order.body.id}/guide`)).status).toBe(404);
    expect((await other.client.post("/api/inventory/transfer-orders", { fromBranchId: null, toBranchId: lda, lines: [{ productId: prod, quantity: 1 }], reason: "Alheio" })).status).toBe(400);
  });
});
