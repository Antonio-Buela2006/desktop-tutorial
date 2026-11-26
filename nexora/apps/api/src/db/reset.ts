import { sql } from "./client.js";
import { config } from "../config.js";

if (config.isProd) throw new Error("db:reset é proibido em produção.");
await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
console.log("Base de dados local limpa.");
await sql.end();
