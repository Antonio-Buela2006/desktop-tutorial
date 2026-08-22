import { describe, expect, it, vi } from "vitest";
import { emailIsConfigured, sendWillyCriticalEmail } from "./willyEmail";

const alert = { to: "gestao@empresa.ao", companyName: "Empresa, Lda.", title: "Stock crítico", recommendation: "Repor produto.", rationale: "O stock está abaixo do mínimo.", confidence: 94, referenceKey: "stock-7" };

describe("alertas por email do WILLY", () => {
  it("permanece seguro e não faz pedido externo enquanto as credenciais não estão configuradas", async () => {
    const fetcher = vi.fn();
    expect(emailIsConfigured({})).toBe(false);
    await expect(sendWillyCriticalEmail(alert, {}, fetcher)).resolves.toEqual({ sent: false, skipped: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("envia um pedido idempotente quando a configuração está disponível", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
    await expect(sendWillyCriticalEmail(alert, { RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "WILLY <alertas@empresa.ao>" }, fetcher)).resolves.toEqual({ sent: true });
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "Idempotency-Key": "willy-stock-7" }) }));
  });
});
