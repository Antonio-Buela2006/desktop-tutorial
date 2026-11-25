/** Rastreio OpenTelemetry: spans por pedido com a empresa, trace id na resposta, IA e privacidade. */
import { beforeAll, describe, expect, it } from "vitest";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace";
import { initTracing, scrubUrl, withSpan } from "../observability/tracing.js";

const exporter = new InMemorySpanExporter();
// Tem de ser antes de carregar a aplicação (o import dinâmico garante a ordem).
initTracing({ exporter, sync: true });

let h: typeof import("./helpers.js");
beforeAll(async () => {
  h = await import("./helpers.js");
});

// Os hooks onResponse terminam depois de a resposta ser entregue: espera antes de limpar/ler os spans.
const settle = () => new Promise((r) => setTimeout(r, 30));
const reset = async () => {
  await settle();
  exporter.reset();
};
const spansOf = (traceId: string) => exporter.getFinishedSpans().filter((s) => s.spanContext().traceId === traceId);

describe("rastreio", () => {
  it("cada pedido tem um trace com a empresa e o trace id volta no cabeçalho", async () => {
    const t = await h.signupCompany();
    const app = await h.getApp();
    await reset();
    const res = await app.inject({ method: "GET", url: "/api/crm/customers?q=segredo", headers: { cookie: t.client.cookie } });
    expect(res.statusCode).toBe(200);
    await settle();
    const traceId = res.headers["x-trace-id"] as string;
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    const spans = spansOf(traceId);
    expect(spans.length).toBeGreaterThan(1); // pedido + hooks + handler
    expect(spans.some((s) => s.attributes["nexora.tenant_id"] === t.tenantId)).toBe(true);
    // a pesquisa (query string) não fica nos atributos
    expect(JSON.stringify(spans.map((s) => s.attributes))).not.toContain("segredo");
  });

  it("health e métricas não são rastreados", async () => {
    const app = await h.getApp();
    await reset();
    const r = await app.inject({ method: "GET", url: "/api/health" });
    expect(r.headers["x-trace-id"]).toBeUndefined();
    await settle();
    expect(exporter.getFinishedSpans().map((s) => [s.name, s.attributes])).toEqual([]);
  });

  it("a chamada ao fornecedor de IA é um span filho do pedido", async () => {
    const t = await h.signupCompany();
    const app = await h.getApp();
    await reset();
    const res = await app.inject({ method: "POST", url: "/api/ai/chat", payload: { message: "Resumo do negócio" }, headers: { cookie: t.client.cookie, "x-nexora-csrf": "1", "content-type": "application/json" } });
    expect(res.statusCode).toBe(200);
    await settle();
    const ai = spansOf(res.headers["x-trace-id"] as string).find((s) => s.name === "ai.provider");
    expect(ai?.attributes["nexora.ai.provider"]).toBe("local");
    expect(ai?.attributes["nexora.ai.model"]).toBe("local");
  });

  it("tokens em URLs são removidos; erros ficam marcados no span", async () => {
    const token = "a".repeat(48);
    expect(scrubUrl(`/api/auth/invitations/${token}?x=1`)).toBe("/api/auth/invitations/:redacted");
    expect(scrubUrl("https://h.test/api/crm/customers/6f1c2a3b-1111-4222-8333-444455556666")).toBe("https://h.test/api/crm/customers/6f1c2a3b-1111-4222-8333-444455556666");
    const app = await h.getApp();
    await reset();
    await app.inject({ method: "GET", url: `/api/auth/invitations/${token}` });
    expect(JSON.stringify(exporter.getFinishedSpans().map((s) => [s.name, s.attributes]))).not.toContain(token);
    await reset();
    await expect(withSpan("teste.falha", {}, async () => { throw new Error("rebentou"); })).rejects.toThrow("rebentou");
    const [s] = exporter.getFinishedSpans();
    expect(s.status.code).toBe(2); // ERROR
    expect(s.events.some((e) => e.name === "exception")).toBe(true);
  });
});
