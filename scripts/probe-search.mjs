/** Live, keyless connectivity probes. Reports remote availability without reading credentials. */
import { PROVIDERS } from "../src/host/providers/index.ts";
import { searchPublicPlatform } from "../src/host/public-platforms.ts";
import { PUBLIC_PLATFORMS } from "../src/shared/search-policy.ts";

const selected = process.argv.slice(2);
const jobs = [
  ...["bing", "ddg", "ddg-lite", "anysearch", "exa", "tavily", "keenable"].map((id) => ({
    id, run: (signal) => PROVIDERS[id].search("DeepSeek Harness", 3, "", undefined, signal),
  })),
  ...Object.keys(PUBLIC_PLATFORMS).map((id) => ({
    id, run: (signal) => searchPublicPlatform(id, "DeepSeek", 3, signal),
  })),
].filter((job) => !selected.length || selected.includes(job.id));
if (!jobs.length) throw new Error("No matching search sources");
let next = 0;
const results = [];
await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    const started = Date.now();
    let result;
    try {
      const response = await job.run(AbortSignal.timeout(15000));
      result = { source: job.id, ok: true, results: response.sources.length, firstUrl: response.sources[0]?.url };
    } catch (error) {
      result = { source: job.id, ok: false, code: error.code ?? error.name, error: error.message };
    }
    result.latencyMs = Date.now() - started;
    results.push(result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }
}));
process.stdout.write(`${JSON.stringify({ tested: results.length, reachable: results.filter((result) => result.ok).length, unavailable: results.filter((result) => !result.ok).map((result) => result.source) })}\n`);
