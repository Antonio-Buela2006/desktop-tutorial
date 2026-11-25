/** Ordenação das listas: só colunas permitidas, ordem estável e salário protegido. */
import { beforeAll, describe, expect, it } from "vitest";
import { addMember, signupCompany } from "./helpers.js";

let t: Awaited<ReturnType<typeof signupCompany>>;
beforeAll(async () => {
  t = await signupCompany({ plan: "professional", modules: ["crm", "inventory", "sales", "finance"] });
  for (const [sku, price] of [["ORD-B", 30], ["ORD-A", 10], ["ORD-C", 20]] as const)
    await t.client.post("/api/inventory/products", { sku, name: `Ordenar ${sku}`, unitPrice: price, initialStock: 5 });
  for (const [name, salary] of [["Zé Baixo", 100], ["Ana Alto", 900], ["Rui Médio", 500]] as const)
    await t.client.post("/api/company/employees", { fullName: name, salary });
});

const skus = (r: any) => r.body.items.map((p: any) => p.sku).filter((s: string) => s.startsWith("ORD-"));

describe("ordenação", () => {
  it("produtos por preço e por SKU, nos dois sentidos", async () => {
    expect(skus(await t.client.get("/api/inventory/products?q=Ordenar&sort=unitPrice&dir=asc"))).toEqual(["ORD-A", "ORD-C", "ORD-B"]);
    expect(skus(await t.client.get("/api/inventory/products?q=Ordenar&sort=unitPrice&dir=desc"))).toEqual(["ORD-B", "ORD-C", "ORD-A"]);
    expect(skus(await t.client.get("/api/inventory/products?q=Ordenar&sort=sku&dir=desc"))).toEqual(["ORD-C", "ORD-B", "ORD-A"]);
  });

  it("colunas fora da lista permitida são ignoradas (ordem por omissão)", async () => {
    for (const sort of ["tenantId", "name;drop table products", "__proto__", "constructor"]) {
      const r = await t.client.get(`/api/inventory/products?q=Ordenar&sort=${encodeURIComponent(sort)}&dir=asc`);
      expect(r.status).toBe(200);
      expect(skus(r)).toEqual(["ORD-A", "ORD-B", "ORD-C"]); // por nome
    }
  });

  it("o salário só ordena para quem o pode ver", async () => {
    const mine = ["Zé Baixo", "Ana Alto", "Rui Médio"];
    const names = (r: any) => r.body.items.map((e: any) => e.fullName).filter((n: string) => mine.includes(n));
    expect(names(await t.client.get("/api/company/employees?sort=salary&dir=desc&pageSize=100"))).toEqual(["Ana Alto", "Rui Médio", "Zé Baixo"]);
    const dir = await addMember(t.client, ["diretor_geral"]);
    const r = await dir.client.get("/api/company/employees?sort=salary&dir=desc&pageSize=100");
    expect(r.body.items[0].salary).toBeUndefined();
    // sem permissão: ordem por nome, que não revela quem ganha mais
    expect(names(r)).toEqual(["Ana Alto", "Rui Médio", "Zé Baixo"].sort((a, b) => a.localeCompare(b)));
    expect(names(await dir.client.get("/api/company/employees?sort=salary&dir=asc&pageSize=100"))).toEqual(names(r));
  });

  it("vendas e finanças aceitam ordenação pelas colunas visíveis", async () => {
    for (const url of ["/api/sales/orders?sort=total&dir=asc", "/api/sales/orders?sort=customer&dir=desc", "/api/finance/transactions?sort=amount&dir=asc", "/api/finance/transactions?sort=category&dir=desc"])
      expect((await t.client.get(url)).status, url).toBe(200);
    const fin = (await t.client.get("/api/finance/transactions?sort=amount&dir=asc&pageSize=100")).body.items.map((x: any) => Number(x.amount));
    expect(fin).toEqual([...fin].sort((a, b) => a - b));
  });
});
