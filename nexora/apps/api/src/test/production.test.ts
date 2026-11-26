/** Ficheiros privados, exportação XLSX/PDF, fatura PDF, métricas e bloqueio de IP. */
import { describe, expect, it } from "vitest";
import { addMember, Client, getApp, signupCompany } from "./helpers.js";

function multipart(fileName: string, contentType: string, data: Buffer, category?: string) {
  const b = "----nexoratest" + Math.random().toString(16).slice(2);
  const parts: Buffer[] = [];
  if (category) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="category"\r\n\r\n${category}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`), data, Buffer.from(`\r\n--${b}--\r\n`));
  return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${b}` };
}

async function upload(c: Client, url: string, fileName: string, type: string, data: Buffer) {
  const app = await getApp();
  const m = multipart(fileName, type, data, "Contrato");
  const res = await app.inject({ method: "POST", url, payload: m.payload, headers: { "content-type": m.contentType, "x-nexora-csrf": "1", cookie: c.cookie } });
  return { status: res.statusCode, body: res.json() };
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

describe("documentos privados", () => {
  it("carrega, lista e descarrega com verificação de tipo e isolamento entre empresas", async () => {
    const A = await signupCompany();
    const B = await signupCompany();
    const emp = (await A.client.post("/api/company/employees", { fullName: "Com Documento" })).body.id;
    const up = await upload(A.client, `/api/files/employee/${emp}`, "contrato.pdf", "application/pdf", PDF);
    expect(up.status).toBe(200);
    const list = await A.client.get(`/api/files/employee/${emp}`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].category).toBe("Contrato");
    const app = await getApp();
    const dl = await app.inject({ method: "GET", url: `/api/files/download/${up.body.id}`, headers: { cookie: A.client.cookie } });
    expect(dl.statusCode).toBe(200);
    expect(dl.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");
    // Outra empresa não lista nem descarrega
    expect((await B.client.get(`/api/files/employee/${emp}`)).status).toBe(404);
    expect((await B.client.get(`/api/files/download/${up.body.id}`)).status).toBe(404);
    expect((await upload(B.client, `/api/files/employee/${emp}`, "x.pdf", "application/pdf", PDF)).status).toBe(404);
    // Tipo declarado que não corresponde ao conteúdo, ou tipo proibido
    expect((await upload(A.client, `/api/files/employee/${emp}`, "falso.pdf", "application/pdf", Buffer.from("MZ executável"))).status).toBe(415);
    expect((await upload(A.client, `/api/files/employee/${emp}`, "x.html", "text/html", Buffer.from("<script>"))).status).toBe(415);
    // Eliminação (lixeira) e auditoria
    expect((await A.client.del(`/api/files/${up.body.id}`)).status).toBe(200);
    expect((await A.client.get(`/api/files/employee/${emp}`)).body).toHaveLength(0);
    const audit = await A.client.get("/api/audit?q=file.");
    expect(audit.body.items.map((e: any) => e.action)).toEqual(expect.arrayContaining(["file.uploaded", "file.downloaded", "file.deleted"]));
  });

  it("sem permissão de edição não é possível carregar documentos", async () => {
    const t = await signupCompany({ plan: "professional" });
    const seller = await addMember(t.client, ["vendedor"]);
    const c = (await t.client.post("/api/crm/customers", { name: "Cliente Doc" })).body.id;
    expect((await upload(seller.client, `/api/files/customer/${c}`, "a.pdf", "application/pdf", PDF)).status).toBe(403);
    expect((await seller.client.get(`/api/files/customer/${c}`)).status).toBe(200);
  });
});

describe("exportação e documentos gerados", () => {
  it("exporta XLSX e PDF respeitando permissões", async () => {
    const t = await signupCompany();
    const app = await getApp();
    for (const [format, magic] of [["xlsx", "PK"], ["pdf", "%PDF"]] as const) {
      const r = await t.client.post("/api/exports", { scope: "inventory", format });
      expect(r.status).toBe(200);
      const file = await app.inject({ method: "GET", url: r.body.downloadUrl, headers: { cookie: t.client.cookie } });
      expect(file.statusCode).toBe(200);
      expect(file.rawPayload.subarray(0, magic.length).toString()).toBe(magic);
    }
  });

  it("gera a fatura em PDF apenas para a própria empresa", async () => {
    const t = await signupCompany({ mode: "paid" });
    const other = await signupCompany();
    const app = await getApp();
    const pdf = await app.inject({ method: "GET", url: `/api/billing/invoices/${t.invoiceId}/pdf`, headers: { cookie: t.client.cookie } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    expect((await other.client.get(`/api/billing/invoices/${t.invoiceId}/pdf`)).status).toBe(404);
  });
});

describe("operação e segurança", () => {
  it("métricas Prometheus exigem token", async () => {
    const app = await getApp();
    process.env.METRICS_TOKEN = "token-de-teste-123";
    expect((await app.inject({ method: "GET", url: "/api/metrics" })).statusCode).toBe(404);
    const ok = await app.inject({ method: "GET", url: "/api/metrics", headers: { authorization: "Bearer token-de-teste-123" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain("nexora_http_requests_total");
  });

  it("bloqueia temporariamente um IP após muitas falhas de autenticação", async () => {
    const { resetIpGuard } = await import("../core/ipguard.js");
    resetIpGuard();
    const app = await getApp();
    const c = new Client(app);
    for (let i = 0; i < 20; i++) await c.post("/api/auth/login", { email: `naoexiste${i}@x.invalid`, password: "errada123456" });
    const r = await c.post("/api/auth/login", { email: "qualquer@x.invalid", password: "errada123456" });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe("IP_TEMPORARILY_BLOCKED");
    resetIpGuard();
  });
});
