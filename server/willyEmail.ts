export type WillyCriticalEmail = {
  to: string;
  companyName: string;
  title: string;
  recommendation: string;
  rationale: string;
  confidence: number;
  referenceKey: string;
};

type RuntimeEnv = { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; [key: string]: string | undefined };
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function emailIsConfigured(env: RuntimeEnv = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}

export async function sendWillyCriticalEmail(input: WillyCriticalEmail, env: RuntimeEnv = process.env, fetcher: Fetcher = fetch) {
  if (!emailIsConfigured(env)) return { sent: false as const, skipped: "not_configured" as const };
  const html = `<main style="font-family:Arial,sans-serif;max-width:620px;color:#102039"><p style="color:#3864B2;font-weight:700;letter-spacing:.08em">NEXORA · WILLY</p><h1>Alerta crítico: ${escapeHtml(input.title)}</h1><p><strong>Recomendação:</strong> ${escapeHtml(input.recommendation)}</p><p><strong>Justificação:</strong> ${escapeHtml(input.rationale)}</p><p><strong>Nível de confiança:</strong> ${input.confidence}%</p><hr/><p style="color:#64748b">Empresa: ${escapeHtml(input.companyName)} · Referência: ${escapeHtml(input.referenceKey)}</p></main>`;
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `willy-${input.referenceKey}` },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [input.to], subject: `WILLY · Alerta crítico — ${input.title}`, html, text: `WILLY — ${input.title}\n\nRecomendação: ${input.recommendation}\nJustificação: ${input.rationale}\nConfiança: ${input.confidence}%` }),
  });
  if (!response.ok) throw new Error(`Não foi possível enviar o alerta por email (${response.status}).`);
  return { sent: true as const };
}
