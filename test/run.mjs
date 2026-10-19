// test/run.mjs — discover and run every *.test.mjs in this folder.
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith(".test.mjs")).sort();

let failed = 0;
for (const f of files) {
  await import(pathToFileURL(join(here, f)).href);
  if (process.exitCode) failed++;
}
console.log(`\n${files.length - failed}/${files.length} test file(s) passed`);
