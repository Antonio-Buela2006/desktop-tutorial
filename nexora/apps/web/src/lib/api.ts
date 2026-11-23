import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    credentials: "include",
    headers: { ...(opts.body !== undefined ? { "content-type": "application/json" } : {}), "x-nexora-csrf": "1" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "ERROR", e.message ?? "Erro inesperado.", e.details);
  }
  return data as T;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body: unknown = {}) => api<T>(p, { method: "POST", body });
export const put = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PUT", body });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });

export function useApi<T = any>(key: QueryKey, path: string | null, opts: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery<T, ApiError>({ queryKey: key, queryFn: () => get<T>(path!), enabled: path !== null && (opts.enabled ?? true), refetchInterval: opts.refetchInterval, retry: (n, e) => e.status >= 500 && n < 2 });
}

/** Mutação que invalida as queries indicadas no sucesso. */
export function useAction<V = any, R = any>(fn: (v: V) => Promise<R>, invalidate: QueryKey[] = []) {
  const qc = useQueryClient();
  return useMutation<R, ApiError, V>({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}

export type Me = {
  user: { id: string; name: string; email: string; locale: string; totpEnabled: boolean };
  tenant: { id: string; name: string; isDemo: boolean; currency: string; settings: any };
  membership: { id: string; level: "primary_admin" | "secondary_admin" | "member" };
  permissions: string[];
  modules: string[];
  subscription: { state: string; caps: { read: boolean; write: boolean; export: boolean; billing: boolean }; plan: { code: string; name: string }; trialEndsAt: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };
  mfaPending: boolean;
  mfaEnrollmentRequired: boolean;
  companies: { tenantId: string; name: string }[];
};

export function useMe() {
  return useQuery<Me | null, ApiError>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await get<Me>("/api/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
  });
}

export const fmtMoney = (n: number | null | undefined, currency = "AOA") =>
  n === null || n === undefined ? "—" : new Intl.NumberFormat("pt-AO", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? "—" : new Intl.NumberFormat("pt-PT").format(n));
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-PT") : "—");
export const fmtDateTime = (d: string | Date | null | undefined) => (d ? new Date(d).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—");
export const newIdempotencyKey = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
