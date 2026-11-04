// Copies the pdf.js worker into /public so the browser can load it at /pdf.worker.min.mjs
// (the journal reader uses it to draw PDF pages). Runs on install, dev and build.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(src, join("public", "pdf.worker.min.mjs"));
