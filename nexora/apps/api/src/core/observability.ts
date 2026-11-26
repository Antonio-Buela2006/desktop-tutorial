/**
 * Métricas em formato Prometheus (GET /api/metrics, protegido por METRICS_TOKEN).
 * Contadores em memória por instância; o coletor (Prometheus/Grafana/Datadog…) agrega entre instâncias.
 */
import type { FastifyInstance } from "fastify";
import { safeEqual } from "./crypto.js";

const requests = new Map<string, number>();
const durations = new Map<string, { sum: number; count: number }>();
const buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];
const hist = new Map<string, number[]>();
const counters = new Map<string, number>();
const started = Date.now();

export const incCounter = (name: string, by = 1) => counters.set(name, (counters.get(name) ?? 0) + by);

export function registerObservability(app: FastifyInstance) {
  app.addHook("onResponse", async (req, reply) => {
    const route = req.routeOptions?.url ?? "unmatched";
    if (route === "/api/metrics") return;
    const key = `method="${req.method}",route="${route}",status="${reply.statusCode}"`;
    requests.set(key, (requests.get(key) ?? 0) + 1);
    const secs = reply.elapsedTime / 1000;
    const dk = `method="${req.method}",route="${route}"`;
    const d = durations.get(dk) ?? { sum: 0, count: 0 };
    d.sum += secs;
    d.count++;
    durations.set(dk, d);
    const h = hist.get(dk) ?? buckets.map(() => 0);
    buckets.forEach((b, i) => { if (secs <= b) h[i]++; });
    hist.set(dk, h);
    if (reply.statusCode >= 500) incCounter("nexora_http_errors_total");
  });

  app.get("/api/metrics", async (req, reply) => {
    const token = process.env.METRICS_TOKEN;
    const given = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token || !given || !safeEqual(given, token)) {
      reply.code(404);
      return { error: { code: "NOT_FOUND", message: "Recurso não encontrado." } };
    }
    const out: string[] = [];
    out.push("# TYPE nexora_http_requests_total counter");
    for (const [k, v] of requests) out.push(`nexora_http_requests_total{${k}} ${v}`);
    out.push("# TYPE nexora_http_request_duration_seconds histogram");
    for (const [k, d] of durations) {
      const h = hist.get(k)!;
      buckets.forEach((b, i) => out.push(`nexora_http_request_duration_seconds_bucket{${k},le="${b}"} ${h[i]}`));
      out.push(`nexora_http_request_duration_seconds_bucket{${k},le="+Inf"} ${d.count}`);
      out.push(`nexora_http_request_duration_seconds_sum{${k}} ${d.sum.toFixed(4)}`);
      out.push(`nexora_http_request_duration_seconds_count{${k}} ${d.count}`);
    }
    for (const [k, v] of counters) out.push(`# TYPE ${k} counter`, `${k} ${v}`);
    const mem = process.memoryUsage();
    out.push(`# TYPE nexora_process_uptime_seconds gauge`, `nexora_process_uptime_seconds ${Math.round((Date.now() - started) / 1000)}`);
    out.push(`# TYPE nexora_process_heap_bytes gauge`, `nexora_process_heap_bytes ${mem.heapUsed}`);
    reply.header("content-type", "text/plain; version=0.0.4");
    return out.join("\n") + "\n";
  });
}
