/** Stock por unidade: transferências, vendas por unidade, anulação e âmbito. */
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, signupCompany } from "./helpers.js";

let t: Awaited<ReturnType<typeof signupCompany>>;
let lda: string;
let bgl: string;

async function newProduct(stock: number) {
  return (await t.client.post("/api/inventory/products", { sku: `ST-${Math.random().toString(36).slice(2, 8)}`, name: "Produto Stock", unitPrice: 500, initialStock: stock })).body.id as string;
}
async function product(id: string) {
  const r = await t.client.get("/api/inventory/products?pageSize=100&q=ST-");
  return r.body.items.find((p: any) => p.id === id);
}
const lvl = (p: any, b: string) => p.levels.find((l: any) => l.branchId === b)?.qty ?? 0;

beforeAll(async () => {
  t = await signupCompany({ plan: "professional" });
  lda = (await t.client.post("/api/company/branches", { code: "LDA", name: "Luanda" })).body.id;
  bgl = (await t.client.post("/api/company/branches", { code: "BGL", name: "Benguela" })).body.id;
});

describe("stock por unidade", () => {
  it("transferências mantêm o total e movem stock entre central e unidades", async () => {
    const id = await newProduct(100);
    expect((await t.client.post("/api/inventory/transfers", { productId: id, fromBranchId: null, toBranchId: lda, quantity: 30, reason: "Abastecimento" })).status).toBe(200);
    expect((await t.client.post("/api/inventory/transfers", { productId: id, fromBranchId: lda, toBranchId: bgl, quantity: 10, reason: "Reposição" })).status).toBe(200);
    const p = await product(id);
    expect(p.stockQty).toBe(100);
    expect(p.centralQty).toBe(70);
    expect(lvl(p, lda)).toBe(20);
    expect(lvl(p, bgl)).toBe(10);
    // não se transfere mais do que existe na origem
    const over = await t.client.post("/api/inventory/transfers", { productId: id, fromBranchId: bgl, toBranchId: lda, quantity: 11, reason: "Excesso" });
    expect(over.status).toBe(409);
    expect(over.body.error.details.available).toBe(10);
  });

  it("a venda de uma unidade só consome o stock dessa unidade; a anulação repõe-no", async () => {
    const id = await newProduct(50);
    await t.client.post("/api/inventory/transfers", { productId: id, fromBranchId: null, toBranchId: lda, quantity: 5, reason: "Abastecimento" });
    // Benguela não tem stock deste produto, apesar de a empresa ter 50
    const noStock = await t.client.post("/api/sales/orders", { branchId: bgl, lines: [{ productId: id, quantity: 1 }] });
    expect(noStock.status).toBe(409);
    const sale = await t.client.post("/api/sales/orders", { branchId: lda, lines: [{ productId: id, quantity: 4 }] });
    expect(sale.status).toBe(200);
    let p = await product(id);
    expect(lvl(p, lda)).toBe(1);
    expect(p.stockQty).toBe(46);
    expect(p.centralQty).toBe(45);
    // venda sem unidade consome o armazém central
    await t.client.post("/api/sales/orders", { lines: [{ productId: id, quantity: 5 }] });
    p = await product(id);
    expect(p.centralQty).toBe(40);
    expect(lvl(p, lda)).toBe(1);
    // anulação repõe na unidade de origem
    await t.client.post(`/api/sales/orders/${sale.body.id}/cancel`, {});
    p = await product(id);
    expect(lvl(p, lda)).toBe(5);
    expect(p.stockQty).toBe(45);
    const moves = await t.client.get(`/api/inventory/movements?productId=${id}&pageSize=100`);
    expect(moves.body.items.some((m: any) => m.reason === `Venda ${sale.body.number}` && m.branchId === lda)).toBe(true);
  });

  it("ajustes por localização não deixam stock negativo", async () => {
    const id = await newProduct(10);
    expect((await t.client.post(`/api/inventory/products/${id}/adjust`, { delta: 3, reason: "Contagem", branchId: lda })).status).toBe(200);
    let p = await product(id);
    expect(lvl(p, lda)).toBe(3);
    expect(p.stockQty).toBe(13);
    expect(p.centralQty).toBe(10);
    expect((await t.client.post(`/api/inventory/products/${id}/adjust`, { delta: -4, reason: "Quebra", branchId: lda })).status).toBe(409);
    expect((await t.client.post(`/api/inventory/products/${id}/adjust`, { delta: -11, reason: "Quebra" })).status).toBe(409);
  });

  it("utilizadores restritos só movimentam as suas unidades e não o armazém central", async () => {
    const id = await newProduct(20);
    await t.client.post("/api/inventory/transfers", { productId: id, fromBranchId: null, toBranchId: lda, quantity: 10, reason: "Abastecimento" });
    const m = await addMember(t.client, ["gestor_stock"]);
    await t.client.put(`/api/company/users/${m.membershipId}/branches`, { branchIds: [lda] });
    expect((await m.client.post("/api/inventory/transfers", { productId: id, fromBranchId: null, toBranchId: lda, quantity: 1, reason: "Tentativa" })).status).toBe(403);
    expect((await m.client.post("/api/inventory/transfers", { productId: id, fromBranchId: lda, toBranchId: bgl, quantity: 1, reason: "Tentativa" })).status).toBe(403);
    // ajuste sem unidade = a sua única unidade
    expect((await m.client.post(`/api/inventory/products/${id}/adjust`, { delta: -2, reason: "Quebra local" })).status).toBe(200);
    const list = await m.client.get("/api/inventory/products?pageSize=100&q=ST-");
    const p = list.body.items.find((x: any) => x.id === id);
    expect(p.levels).toEqual([{ branchId: lda, qty: 8 }]);
  });
});
