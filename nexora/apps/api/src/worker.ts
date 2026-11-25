import "./observability/tracing-init.js";
import { runAllJobs } from "./jobs/jobs.js";

const INTERVAL = Number(process.env.WORKER_INTERVAL_MS ?? 5 * 60_000);
async function tick() {
  try {
    const r = await runAllJobs();
    console.log(new Date().toISOString(), "jobs", JSON.stringify(r));
  } catch (e) {
    console.error("worker error", e);
  }
}
await tick();
setInterval(tick, INTERVAL);
