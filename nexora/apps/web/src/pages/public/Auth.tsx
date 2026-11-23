import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, fmtMoney, get, post, useApi } from "../../lib/api";
import { Alert, Button, ErrorText, Field, Input, Loading, Select, cx } from "../../components/ui";
import { Logo } from "../../layouts/PublicLayout";

function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await post("/api/auth/login", { email, password });
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (r.mfaRequired) nav("/login/2fa");
      else if (r.mfaEnrollmentRequired) nav("/app/security?enroll=1");
      else nav(params.get("next") || "/app");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Entrar na Nexora" subtitle="Aceda ao painel da sua empresa.">
      <form onSubmit={submit} className="space-y-4">
        {err ? <ErrorText error={err} /> : null}
        <Field label="E-mail"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Palavra-passe"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button className="w-full" loading={busy}>Entrar</Button>
        <div className="flex justify-between text-sm">
          <Link to="/recuperar" className="text-brand-700 hover:underline dark:text-brand-100">Esqueci-me da palavra-passe</Link>
          <Link to="/registo" className="text-brand-700 hover:underline dark:text-brand-100">Criar conta</Link>
        </div>
      </form>
      {import.meta.env.DEV && <p className="mt-6 rounded bg-slate-100 p-2 text-xs muted dark:bg-slate-800">Demo local: demo@nexora.local / DemoNexora2026</p>}
    </AuthCard>
  );
}

export function MfaVerify() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/api/auth/2fa/verify", { code });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav("/app");
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <AuthCard title="Verificação em dois passos" subtitle="Introduza o código de 6 dígitos da sua aplicação autenticadora, ou um código de recuperação.">
      <form onSubmit={submit} className="space-y-4">
        {err ? <ErrorText error={err} /> : null}
        <Field label="Código"><Input inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Button className="w-full">Verificar</Button>
      </form>
    </AuthCard>
  );
}

export function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <AuthCard title="Recuperar palavra-passe" subtitle="Enviaremos um link válido durante 30 minutos.">
      {sent ? <Alert tone="success">Se existir uma conta com este e-mail, receberá instruções em breve.</Alert> : (
        <form onSubmit={async (e) => { e.preventDefault(); await post("/api/auth/password/forgot", { email }); setSent(true); }} className="space-y-4">
          <Field label="E-mail"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button className="w-full">Enviar link</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<unknown>(null);
  return (
    <AuthCard title="Definir nova palavra-passe" subtitle="Mínimo 10 caracteres, com letras e números. Todas as sessões serão terminadas.">
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await post("/api/auth/password/reset", { token: params.get("token"), password: pw }); nav("/login"); } catch (x) { setErr(x); } }}>
        {err ? <ErrorText error={err} /> : null}
        <Field label="Nova palavra-passe"><Input type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Button className="w-full">Guardar</Button>
      </form>
    </AuthCard>
  );
}

export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const nav = useNavigate();
  const qc = useQueryClient();
  const info = useApi<{ company: string; email: string; name: string; existingAccount: boolean }>(["invite", token], token ? `/api/auth/invitations/${token}` : null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<unknown>(null);
  if (info.isLoading) return <Loading />;
  if (info.error) return <AuthCard title="Convite"><ErrorText error={info.error} /></AuthCard>;
  const i = info.data!;
  return (
    <AuthCard title={`Juntar-se a ${i.company}`} subtitle={i.existingAccount ? `Já tem conta Nexora (${i.email}). Confirme a sua palavra-passe.` : `Crie a sua palavra-passe para ${i.email}.`}>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await post("/api/auth/invitations/accept", { token, password: pw }); await qc.invalidateQueries({ queryKey: ["me"] }); nav("/app"); } catch (x) { setErr(x); } }}>
        {err ? <ErrorText error={err} /> : null}
        <Field label="Palavra-passe" hint={i.existingAccount ? undefined : "Mínimo 10 caracteres, com letras e números."}><Input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Button className="w-full">Aceitar convite</Button>
      </form>
    </AuthCard>
  );
}

/** Registo de empresa em passos (§2.1): empresa → administrador → plano e módulos → capacidade → resumo. */
export function Signup() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const plans = useApi<any[]>(["public-plans"], "/api/public/plans");
  const modules = useApi<any[]>(["public-modules"], "/api/public/modules");
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    companyName: "", legalName: "", taxId: "", adminName: "", email: "", password: "",
    planCode: params.get("plano") ?? "professional", mode: "trial" as "trial" | "paid", modules: ["crm", "inventory"] as string[], billingCycle: "monthly", extraUsers: 0, acceptTerms: false,
  });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const plan = plans.data?.find((p) => p.code === f.planCode);
  const sb = plan?.sandbox;
  const steps = ["Empresa", "Administrador", "Plano e módulos", "Resumo"];

  const toggleModule = (code: string) => {
    const mods = modules.data ?? [];
    let next = f.modules.includes(code) ? f.modules.filter((m) => m !== code) : [...f.modules, code];
    // adiciona dependências automaticamente
    for (const m of next) for (const d of mods.find((x) => x.code === m)?.dependsOn ?? []) if (!next.includes(d)) next = [...next, d];
    set("modules", next);
  };
  const estimate = (() => {
    if (!sb || f.mode !== "paid") return null;
    const base = f.billingCycle === "yearly" ? sb.priceYearly : sb.priceMonthly;
    const months = f.billingCycle === "yearly" ? 12 : 1;
    const extraMods = Math.max(0, f.modules.length - (sb.includedModules ?? f.modules.length));
    return base + extraMods * (sb.extraModulePrice ?? 0) * months + f.extraUsers * (sb.extraUserPrice ?? 0) * months;
  })();

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await post("/api/auth/signup", {
        company: { name: f.companyName, legalName: f.legalName || undefined, taxId: f.taxId || undefined },
        admin: { name: f.adminName, email: f.email, password: f.password },
        planCode: f.planCode, modules: f.modules, mode: f.mode, billingCycle: f.billingCycle, extraUsers: f.extraUsers, acceptTerms: f.acceptTerms,
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav(r.mode === "paid" ? "/app/billing?pay=" + r.invoiceId : "/app/security?enroll=1");
    } catch (e) {
      setErr(e);
      if (e instanceof ApiError && e.code === "EMAIL_EXISTS") setStep(1);
    } finally {
      setBusy(false);
    }
  };

  const canNext = [f.companyName.trim().length >= 2, f.adminName.trim().length >= 2 && /.+@.+/.test(f.email) && f.password.length >= 10, f.mode === "trial" || f.modules.length > 0, f.acceptTerms][step];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Registar empresa</h1>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Passos">
        {steps.map((s, i) => <li key={s} className={cx("rounded-full px-3 py-1", i === step ? "bg-brand-600 text-white" : i < step ? "bg-brand-100 text-brand-700" : "bg-slate-100 dark:bg-slate-800")} aria-current={i === step ? "step" : undefined}>{i + 1}. {s}</li>)}
      </ol>
      <div className="card mt-6 space-y-4 p-6">
        {err ? <ErrorText error={err} /> : null}
        {step === 0 && (
          <>
            <Field label="Nome da empresa"><Input required value={f.companyName} onChange={(e) => set("companyName", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Denominação legal (opcional)"><Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} /></Field>
              <Field label="NIF (opcional)"><Input value={f.taxId} onChange={(e) => set("taxId", e.target.value)} /></Field>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <Alert>O administrador principal pode ser o proprietário, diretor, responsável de TI ou outra pessoa autorizada. A titularidade só pode ser transferida por um processo seguro.</Alert>
            <Field label="Nome do administrador principal"><Input value={f.adminName} onChange={(e) => set("adminName", e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Palavra-passe" hint="Mínimo 10 caracteres, com letras e números."><Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} /></Field>
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["trial", "paid"] as const).map((m) => (
                <button type="button" key={m} onClick={() => set("mode", m)} className={cx("card p-4 text-left", f.mode === m && "ring-2 ring-brand-500")} aria-pressed={f.mode === m}>
                  <p className="font-semibold">{m === "trial" ? "Demonstração gratuita (14 dias)" : "Subscrição paga"}</p>
                  <p className="mt-1 text-sm muted">{m === "trial" ? "Acesso amplo, dados fictícios, sem pagamento." : "Escolha módulos e capacidade; ativação automática após pagamento."}</p>
                </button>
              ))}
            </div>
            <Field label="Plano">
              <Select value={f.planCode} onChange={(e) => set("planCode", e.target.value)}>
                {plans.data?.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
            </Field>
            {f.mode === "paid" && (
              <>
                <fieldset>
                  <legend className="label">Módulos (franquia do plano: {sb?.includedModules ?? "a definir"})</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modules.data?.filter((m) => m.available).map((m) => (
                      <label key={m.code} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                        <input type="checkbox" checked={f.modules.includes(m.code)} onChange={() => toggleModule(m.code)} className="mt-0.5" />
                        <span><strong>{m.name}</strong>{m.dependsOn.length > 0 && <span className="block text-xs muted">Requer: {m.dependsOn.join(", ")}</span>}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Periodicidade"><Select value={f.billingCycle} onChange={(e) => set("billingCycle", e.target.value)}><option value="monthly">Mensal</option><option value="yearly">Anual</option></Select></Field>
                  <Field label="Utilizadores adicionais" hint={`Incluídos no plano: ${sb?.maxUsers ?? "a definir"}`}><Input type="number" min={0} value={f.extraUsers} onChange={(e) => set("extraUsers", Math.max(0, Number(e.target.value)))} /></Field>
                </div>
              </>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="muted">Empresa</dt><dd>{f.companyName}</dd>
              <dt className="muted">Administrador</dt><dd>{f.adminName} · {f.email}</dd>
              <dt className="muted">Modalidade</dt><dd>{f.mode === "trial" ? "Demonstração 14 dias" : "Subscrição paga"}</dd>
              <dt className="muted">Plano</dt><dd>{plan?.name}</dd>
              {f.mode === "paid" && <><dt className="muted">Módulos</dt><dd>{f.modules.join(", ")}</dd></>}
              <dt className="muted">Limites</dt><dd>{sb ? `${sb.maxEmployees} funcionários · ${sb.maxUsers + f.extraUsers} utilizadores` : "a definir"}</dd>
              {estimate !== null && <><dt className="muted">Valor</dt><dd>{fmtMoney(estimate, plan?.currency)} / {f.billingCycle === "yearly" ? "ano" : "mês"} <span className="text-xs muted">(valor de teste — sandbox)</span></dd></>}
            </dl>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} className="mt-0.5" />
              <span>Aceito os <Link to="/legal/termos" className="underline" target="_blank">termos de serviço</Link> e a <Link to="/legal/privacidade" className="underline" target="_blank">política de privacidade</Link>.</span>
            </label>
          </>
        )}
        <div className="flex justify-between pt-2">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</Button>
          {step < 3 ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar</Button> : <Button disabled={!canNext} loading={busy} onClick={submit}>{f.mode === "trial" ? "Criar demonstração" : "Criar e pagar"}</Button>}
        </div>
      </div>
      <p className="mt-4 text-center text-sm muted">Já tem conta? <Link to="/login" className="underline">Entrar</Link></p>
    </div>
  );
}

/** Página do fornecedor de pagamentos SANDBOX (simula o checkout externo). */
export function SandboxCheckout() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const nav = useNavigate();
  const qc = useQueryClient();
  const info = useApi<any>(["sandbox", token], token ? `/api/payments/sandbox/${token}` : null);
  const [done, setDone] = useState<string | null>(null);
  const pay = async (outcome: "succeeded" | "failed") => {
    await post(`/api/payments/sandbox/${token}/complete`, { outcome });
    setDone(outcome);
    await qc.invalidateQueries();
  };
  if (info.isLoading) return <Loading />;
  return (
    <AuthCard title="Pagamento (ambiente sandbox)" subtitle="Simulação do fornecedor de pagamentos. Nenhum valor real é cobrado.">
      {info.error ? <ErrorText error={info.error} /> : (
        <div className="space-y-4 text-sm">
          <p>Fatura <strong>{info.data.invoice}</strong> · {info.data.company}</p>
          <p className="text-2xl font-semibold">{fmtMoney(info.data.amount, info.data.currency)}</p>
          {done ? (
            <>
              <Alert tone={done === "succeeded" ? "success" : "error"}>{done === "succeeded" ? "Pagamento confirmado via webhook assinado. A subscrição foi atualizada." : "Pagamento recusado."}</Alert>
              <Button onClick={() => nav("/app/billing")}>Voltar à subscrição</Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => pay("succeeded")}>Pagar</Button>
              <Button variant="secondary" onClick={() => pay("failed")}>Simular falha</Button>
            </div>
          )}
        </div>
      )}
    </AuthCard>
  );
}

export { get };
