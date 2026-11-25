/**
 * Rastreio distribuído (OpenTelemetry). Desligado por omissão; liga-se com
 * `OTEL_EXPORTER_OTLP_ENDPOINT` (qualquer coletor OTLP/HTTP: Grafana Tempo, Jaeger, Datadog, Honeycomb…)
 * ou `OTEL_TRACES_EXPORTER=console` para desenvolvimento. Nenhum fornecedor fica fixado no código.
 *
 * Privacidade: só ficam atributos técnicos. Corpos, cabeçalhos e cookies não são registados;
 * a query string é removida e segmentos de URL com aspeto de token são substituídos por `:redacted`.
 */
import { context, propagation, SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  ParentBasedSampler,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
  TracerProvider,
  type ReadableSpan,
  type SpanExporter,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { FastifyOtelInstrumentation } from "@fastify/otel";

const NOT_TRACED = ["/api/health", "/api/metrics"];
const URL_ATTRS = ["url.path", "url.full", "url.query", "http.target", "http.url"];

/** Remove a query string e substitui segmentos com aspeto de token (convites, recuperação de palavra-passe…). */
export function scrubUrl(v: string): string {
  const [base] = v.split("?");
  const m = base.match(/^([a-z]+:\/\/[^/]+)?(.*)$/i)!;
  const path = m[2]
    .split("/")
    .map((s) => (/^[A-Za-z0-9_-]{20,}$/.test(s) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) ? ":redacted" : s))
    .join("/");
  return (m[1] ?? "") + path;
}

class RedactingProcessor implements SpanProcessor {
  constructor(private inner: SpanProcessor) {}
  onStart(span: Parameters<SpanProcessor["onStart"]>[0], ctx: Parameters<SpanProcessor["onStart"]>[1]) {
    this.inner.onStart(span, ctx);
  }
  onEnd(span: ReadableSpan) {
    const attrs = span.attributes as Attributes;
    for (const k of URL_ATTRS) {
      if (k === "url.query") delete attrs[k];
      else if (typeof attrs[k] === "string") attrs[k] = scrubUrl(attrs[k] as string);
    }
    this.inner.onEnd(span);
  }
  forceFlush() {
    return this.inner.forceFlush();
  }
  shutdown() {
    return this.inner.shutdown();
  }
}

let provider: TracerProvider | null = null;
let fastifyOtel: FastifyOtelInstrumentation | null = null;

export const tracingEnabled = () => provider !== null;

/**
 * Inicializa o rastreio. Tem de correr antes de o Fastify ser carregado (é o primeiro import de
 * `server.ts`/`worker.ts`). `exporter` permite aos testes recolher os spans em memória.
 */
export function initTracing(opts: { exporter?: SpanExporter; sync?: boolean } = {}) {
  if (provider) return provider;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const mode = process.env.OTEL_TRACES_EXPORTER;
  const exporter = opts.exporter ?? (endpoint ? new OTLPTraceExporter() : mode === "console" ? new ConsoleSpanExporter() : null);
  if (!exporter) return null;
  const ratio = Math.min(1, Math.max(0, Number(process.env.OTEL_TRACES_SAMPLER_RATIO ?? 1)));
  provider = new TracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "nexora-api",
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "dev",
      "deployment.environment.name": process.env.NODE_ENV ?? "development",
    }),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) }),
    spanProcessors: [new RedactingProcessor(opts.sync ? new SimpleSpanProcessor({ exporter }) : new BatchSpanProcessor({ exporter }))],
  });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);
  fastifyOtel = new FastifyOtelInstrumentation({ ignorePaths: (o: { url: string }) => NOT_TRACED.includes(o.url) });
  fastifyOtel.setTracerProvider(provider);
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => NOT_TRACED.some((p) => req.url?.startsWith(p)) })],
  });
  const flush = () => void provider?.shutdown();
  process.once("SIGTERM", flush);
  process.once("beforeExit", flush);
  return provider;
}

/** Plugin do Fastify a registar antes das rotas (null se o rastreio estiver desligado). */
export const fastifyTracingPlugin = () => fastifyOtel?.plugin() ?? null;

/** Span do pedido atual (o criado pelo @fastify/otel), se existir. */
export function requestSpan(req: unknown): Span | undefined {
  const fn = (req as { opentelemetry?: () => { instrumented?: boolean; span?: Span } }).opentelemetry;
  const o = typeof fn === "function" ? fn.call(req) : undefined;
  return o?.instrumented ? o.span : undefined;
}

const tracer = () => trace.getTracer("nexora");

/** Corre `fn` dentro de um span; regista exceções e o estado de erro. Sem rastreio, é transparente. */
export async function withSpan<T>(name: string, attributes: Attributes, fn: (span: Span) => Promise<T>): Promise<T> {
  return tracer().startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
      throw e;
    } finally {
      span.end();
    }
  });
}
