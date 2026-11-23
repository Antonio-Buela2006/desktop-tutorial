import { Link, useParams } from "react-router-dom";
import { T, useI18n } from "../../lib/i18n";
import { ArrowRight, BarChart3, Bot, Check, Building2, KeyRound, Layers, Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { fmtMoney, fmtNum, useApi } from "../../lib/api";
import { Badge, Loading } from "../../components/ui";

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <section className={`mx-auto max-w-6xl px-4 py-14 ${className}`}>{children}</section>;
const H = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div className="mb-8 max-w-2xl">
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{children}</h1>
    {sub && <p className="mt-3 text-lg muted">{sub}</p>}
  </div>
);

const features = [
  { icon: Building2, title: "Multiempresa com isolamento rigoroso", text: "Cada empresa é um ambiente isolado. Nenhuma empresa acede aos dados de outra — verificado por testes automáticos." },
  { icon: Layers, title: "Contratação modular", text: "Escolha os módulos de que precisa. Troque sem custo nos primeiros 7 dias; depois com ajuste proporcional." },
  { icon: Users, title: "Funcionários e utilizadores separados", text: "Registe toda a equipa no cadastro e dê acesso apenas a quem precisa, com limites independentes." },
  { icon: KeyRound, title: "Permissões granulares", text: "Funções predefinidas e personalizadas, ajustes por utilizador, acessos temporários e segregação de funções." },
  { icon: Bot, title: "IA que respeita permissões", text: "Assistente que consulta, resume, prevê e propõe ações — ações sensíveis exigem sempre aprovação humana." },
  { icon: BarChart3, title: "Dashboards e previsões", text: "Indicadores por função, alertas inteligentes e previsões com intervalos e pressupostos explícitos." },
  { icon: ShieldCheck, title: "Segurança desde a conceção", text: "2FA com apps autenticadoras, gestão de sessões, auditoria protegida contra alterações e backups." },
  { icon: Lock, title: "Os seus dados são seus", text: "Exportação em formatos abertos, área recuperável de 30 dias e acesso de suporte só com a sua autorização." },
];

export function Home() {
  const { tr } = useI18n();
  return (
    <>
      <Section className="pb-6 pt-16 sm:pt-24">
        <Badge tone="blue"><Sparkles className="mr-1 h-3 w-3" /> <T>Demonstração gratuita de 14 dias · sem cartão</T></Badge>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"><T>A gestão da sua empresa num só lugar, com IA ao seu lado.</T></h1>
        <p className="mt-4 max-w-2xl text-lg muted"><T>A Nexora junta clientes, stock, vendas, finanças e pessoas numa plataforma web segura e modular, pensada para pequenas e médias empresas.</T></p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/registo" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700"><T>Começar demonstração</T> <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/funcionalidades" className="rounded-lg border border-slate-300 px-5 py-3 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"><T>Ver funcionalidades</T></Link>
        </div>
      </Section>
      <Section className="pt-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.slice(0, 4).map((f) => (
            <div key={tr(f.title)} className="card p-5">
              <f.icon className="h-6 w-6 text-brand-600" aria-hidden />
              <h2 className="mt-3 font-semibold">{tr(f.title)}</h2>
              <p className="mt-1 text-sm muted">{tr(f.text)}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <div className="card grid gap-6 p-8 sm:grid-cols-[2fr_1fr] sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold"><T>Pronto para experimentar?</T></h2>
            <p className="mt-2 muted"><T>A demonstração cria um ambiente isolado com dados fictícios, separado dos seus dados reais. Pode converter para um plano pago quando quiser.</T></p>
          </div>
          <Link to="/registo" className="justify-self-start rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700 sm:justify-self-end"><T>Criar conta de empresa</T></Link>
        </div>
      </Section>
    </>
  );
}

export function Features() {
  const { tr } = useI18n();
  return (
    <Section>
      <H sub="Tudo o que está disponível hoje. Funcionalidades ainda não lançadas não são apresentadas como disponíveis."><T>Funcionalidades</T></H>
      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <div key={tr(f.title)} className="card flex gap-4 p-5">
            <f.icon className="h-6 w-6 shrink-0 text-brand-600" aria-hidden />
            <div><h2 className="font-semibold">{tr(f.title)}</h2><p className="mt-1 text-sm muted">{tr(f.text)}</p></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Modules() {
  const { data, isLoading } = useApi<any[]>(["public-modules"], "/api/public/modules");
  return (
    <Section>
      <H sub="A Nexora prevê 18 áreas de gestão. Os módulos disponíveis podem ser contratados já; os restantes estão em definição."><T>Módulos</T></H>
      {isLoading ? <Loading /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((m) => (
            <div key={m.code} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{m.name}</h2>
                {m.available ? <Badge tone="green"><T>Disponível</T></Badge> : <Badge><T>Em definição</T></Badge>}
              </div>
              <p className="mt-1 text-sm muted">{m.description}</p>
              {m.dependsOn.length > 0 && <p className="mt-2 text-xs muted">Requer: {m.dependsOn.join(", ")}</p>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function Pricing() {
  const { tr } = useI18n();
  const { data, isLoading } = useApi<any[]>(["public-plans"], "/api/public/plans");
  return (
    <Section>
      <H sub="Três planos base, com utilizadores e módulos adicionais. Preços em definição: são publicados aqui quando aprovados."><T>Planos</T></H>
      {isLoading ? <Loading /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {data?.map((p, i) => (
            <div key={p.code} className={`card flex flex-col p-6 ${i === 1 ? "ring-2 ring-brand-500" : ""}`}>
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm muted">{p.description}</p>
              <p className="mt-4 text-3xl font-semibold">{p.priceMonthly !== null ? fmtMoney(p.priceMonthly, p.currency) : tr("Preço a definir")}</p>
              {p.priceMonthly !== null && <p className="text-xs muted"><T>por mês</T></p>}
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  ["Funcionários registados", p.maxEmployees],
                  ["Utilizadores com conta", p.maxUsers],
                  ["Módulos incluídos", p.includedModules],
                  ["Créditos de IA / mês", p.aiCreditsMonthly],
                ].map(([l, v]) => (
                  <li key={l as string} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />{tr(l as string)}: <strong>{v === null ? tr("a definir") : fmtNum(v as number)}</strong></li>
                ))}
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /><T>Utilizadores e módulos adicionais</T></li>
              </ul>
              <Link to={`/registo?plano=${p.code}`} className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"><T>Experimentar 14 dias</T></Link>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-sm muted"><T>Moeda, impostos e documentos fiscais estão em validação com consultoria local antes da comercialização.</T></p>
    </Section>
  );
}

export function SecurityPage() {
  const { tr } = useI18n();
  const items = [
    ["Isolamento multiempresa", "Todas as operações aplicam o contexto da empresa no servidor; o identificador da empresa nunca é aceite do navegador."],
    ["Autenticação forte", "Palavra-passe com bloqueio após tentativas falhadas, 2FA com Google/Microsoft Authenticator e códigos de recuperação."],
    ["Sessões e dispositivos", "Veja onde tem sessão ativa, termine sessões remotamente e receba alertas de novos dispositivos."],
    ["Permissões no servidor", "Ocultar botões não basta: cada pedido é autorizado no servidor por função, módulo e estado da subscrição."],
    ["Auditoria imutável", "Ações relevantes ficam registadas numa cadeia de hashes que deteta alterações indevidas."],
    ["Acesso de suporte excecional", "A equipa Nexora só vê conteúdo com autorização da empresa, por tempo e âmbito limitados, e tudo fica registado."],
    ["IA controlada", "A IA herda as permissões de quem pede, trata documentos como dados e nunca executa ações sensíveis sem aprovação."],
    ["Retenção e eliminação", "Eliminação recuperável durante 30 dias, exportação em formatos abertos e retenção legal de registos financeiros."],
  ];
  return (
    <Section>
      <H sub="Segurança e privacidade desde a conceção."><T>Segurança e privacidade</T></H>
      <div className="grid gap-4 sm:grid-cols-2">{items.map(([t, d]) => <div key={t} className="card p-5"><h2 className="font-semibold">{tr(t)}</h2><p className="mt-1 text-sm muted">{tr(d)}</p></div>)}</div>
      <p className="mt-6 text-sm muted"><T>A conformidade legal com a legislação angolana de proteção de dados está em avaliação profissional; não declaramos conformidade antes dessa avaliação.</T></p>
    </Section>
  );
}

export function About() {
  return (
    <Section>
      <H sub="Uma plataforma para centralizar a gestão das PME, reduzir ferramentas dispersas e trazer IA útil e segura para o dia a dia."><T>Sobre a Nexora</T></H>
      <div className="prose max-w-2xl text-sm muted">
        <p><T>A Nexora nasce para o mercado angolano e lusófono, com uma arquitetura preparada para crescer para novos mercados, idiomas e aplicações móveis.</T></p>
        <p className="mt-3"><T>Princípios: segurança e privacidade desde a conceção, isolamento entre empresas, modularidade, transparência e evolução incremental testada.</T></p>
      </div>
    </Section>
  );
}

export function Contact() {
  return (
    <Section>
      <H sub="Fale connosco sobre planos, demonstrações ou suporte técnico."><T>Contacto e suporte</T></H>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5"><h2 className="font-semibold"><T>Comercial</T></h2><p className="mt-1 text-sm muted"><T>Contactos comerciais oficiais a publicar pela Nexora.</T></p></div>
        <div className="card p-5"><h2 className="font-semibold"><T>Suporte a clientes</T></h2><p className="mt-1 text-sm muted"><T>Clientes com conta: use o painel da empresa. Se precisar que um técnico veja os seus dados, autorize um acesso temporário em Definições → Acesso de suporte.</T></p></div>
      </div>
    </Section>
  );
}

const faqs = [
  ["Preciso de cartão para a demonstração?", "Não. A demonstração dura 14 dias, usa dados fictícios num ambiente isolado e não exige pagamento antecipado."],
  ["Qual a diferença entre funcionários e utilizadores?", "Funcionários são as pessoas registadas na empresa (com ou sem acesso). Utilizadores são as contas com login. Cada plano tem limites independentes para ambos."],
  ["O que acontece se atingir o limite de utilizadores?", "Não é possível criar novas contas até comprar capacidade adicional ou fazer upgrade. As contas existentes continuam a funcionar."],
  ["Posso trocar de módulos?", "Sim. Nos primeiros 7 dias após a ativação a troca é gratuita; depois aplica-se cobrança ou crédito proporcional. Desativar um módulo nunca apaga dados."],
  ["E se um pagamento atrasar?", "Dias 1–3: acesso normal com avisos. Dias 4–8: somente leitura. A partir do dia 9: suspensão, com os dados preservados. Ao pagar, o acesso é restaurado."],
  ["Posso cancelar a qualquer momento?", "Sim. Mantém o acesso até ao fim do período pago e pode exportar os seus dados. Depois, os dados são conservados durante o prazo de retenção e eliminados ou anonimizados."],
  ["A IA pode fazer pagamentos ou alterar salários sozinha?", "Não. Ações financeiras, laborais, de permissões ou irreversíveis exigem sempre aprovação humana de quem tem permissão."],
  ["A equipa da Nexora vê os meus dados?", "Não livremente. Apenas com autorização expressa da sua empresa, por tempo e âmbito limitados, com registo de auditoria."],
];
export function Faq() {
  const { tr } = useI18n();
  return (
    <Section>
      <H><T>Perguntas frequentes</T></H>
      <div className="space-y-2">
        {faqs.map(([q, a]) => (
          <details key={q} className="card group p-4">
            <summary className="cursor-pointer font-medium">{tr(q)}</summary>
            <p className="mt-2 text-sm muted">{tr(a)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

const legal: Record<string, [string, string[]]> = {
  termos: ["Termos de serviço", ["Versão provisória — sujeita a revisão jurídica antes da comercialização.", "A Nexora presta um serviço SaaS de gestão empresarial por subscrição. A empresa cliente é responsável pelos dados que introduz e pelas permissões que concede.", "Cancelamento a qualquer momento, com acesso até ao fim do período pago. Regras de atraso: tolerância (dias 1–3), somente leitura (4–8), suspensão (9+)."]],
  privacidade: ["Política de privacidade", ["Versão provisória — sujeita a revisão jurídica (Angola e mercados de operação).", "Tratamos dados com minimização, encriptação em trânsito e em repouso, e isolamento entre empresas.", "Retenção após cancelamento: proposta inicial de 90 dias, configurável e sujeita a validação legal; registos com obrigação legal são conservados pelo prazo aplicável.", "Acesso técnico excecional apenas com autorização da empresa, tempo limitado e auditoria."]],
  cookies: ["Política de cookies", ["Usamos apenas cookies estritamente necessários: sessão autenticada (httpOnly) e preferências locais (idioma e tema)."]],
};
export function Legal() {
  const { tr } = useI18n();
  const { doc = "termos" } = useParams();
  const [title, paras] = legal[doc] ?? legal.termos;
  return (
    <Section>
      <H>{tr(title)}</H>
      <div className="max-w-3xl space-y-3 text-sm">{paras.map((p) => <p key={p}>{tr(p)}</p>)}</div>
    </Section>
  );
}
