/**
 * Previsões simples e explicáveis (regressão linear por mínimos quadrados).
 * Devolvem sempre período, dados usados, pressupostos, limitações e intervalo.
 * Nunca são apresentadas como certezas.
 */

export type Forecast = {
  method: string;
  history: { period: string; value: number }[];
  predictions: { period: string; value: number; low: number; high: number }[];
  confidenceLevel: number;
  assumptions: string[];
  limitations: string[];
  sufficientData: boolean;
};

export function linearForecast(history: { period: string; value: number }[], horizon: number, nextPeriods: string[]): Forecast {
  const n = history.length;
  const limitations = [
    "Modelo linear simples: não capta sazonalidade nem eventos excecionais.",
    "Baseia-se apenas no histórico registado na Nexora para esta empresa.",
  ];
  if (n < 3) {
    return {
      method: "insuficiente",
      history,
      predictions: [],
      confidenceLevel: 0,
      assumptions: [],
      limitations: [...limitations, "São necessários pelo menos 3 períodos de histórico."],
      sufficientData: false,
    };
  }
  const xs = history.map((_, i) => i);
  const ys = history.map((h) => h.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = sxx === 0 ? 0 : xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / sxx;
  const intercept = my - slope * mx;
  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const se = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2));
  const z = 1.28; // ~80%
  const predictions = Array.from({ length: horizon }, (_, k) => {
    const x = n + k;
    const value = Math.max(0, intercept + slope * x);
    // Erro de previsão cresce com a distância à média
    const spread = z * se * Math.sqrt(1 + 1 / n + (x - mx) ** 2 / (sxx || 1));
    return { period: nextPeriods[k] ?? `+${k + 1}`, value: Math.round(value), low: Math.max(0, Math.round(value - spread)), high: Math.round(value + spread) };
  });
  return {
    method: "Regressão linear (mínimos quadrados) sobre totais mensais",
    history,
    predictions,
    confidenceLevel: 0.8,
    assumptions: [
      `Tendência mensal estimada: ${slope >= 0 ? "+" : ""}${Math.round(slope)} por período.`,
      "As condições de mercado, preços e capacidade mantêm-se semelhantes ao histórico.",
    ],
    limitations: n < 6 ? [...limitations, "Histórico curto: intervalo de confiança largo."] : limitations,
    sufficientData: true,
  };
}

/** Simulação de cenário: efeito de alteração de preço e/ou custos sobre receita e margem. */
export function simulatePriceChange(
  base: { revenue: number; cost: number },
  pricePct: number,
  costPct: number,
  elasticity = -1.0,
) {
  const volumeFactor = Math.max(0, 1 + (elasticity * pricePct) / 100);
  const revenue = base.revenue * (1 + pricePct / 100) * volumeFactor;
  const cost = base.cost * (1 + costPct / 100) * volumeFactor;
  return {
    base: { ...base, margin: base.revenue - base.cost },
    scenario: { revenue: Math.round(revenue), cost: Math.round(cost), margin: Math.round(revenue - cost) },
    assumptions: [
      `Elasticidade-preço da procura assumida: ${elasticity} (cada +1% de preço reduz o volume em ${Math.abs(elasticity)}%).`,
      "Custos variáveis proporcionais ao volume.",
    ],
    limitations: ["Simulação ilustrativa; não considera concorrência, sazonalidade ou custos fixos."],
  };
}
