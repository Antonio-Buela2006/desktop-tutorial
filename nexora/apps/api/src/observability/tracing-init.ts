// Primeiro import dos pontos de entrada: liga o rastreio (se configurado) antes de carregar o Fastify.
import { initTracing } from "./tracing.js";
initTracing();
