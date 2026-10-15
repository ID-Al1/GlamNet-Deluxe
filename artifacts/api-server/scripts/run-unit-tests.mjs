// Bundles the unit tests (plain TypeScript, no database) and runs them with Node's built-in test runner.
import { build } from "esbuild";
import { readdirSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawnSync } from "child_process";

const dir = path.resolve("tests");
const entries = readdirSync(dir).filter((f) => f.endsWith(".test.ts")).map((f) => path.join(dir, f));
const out = mkdtempSync(path.join(tmpdir(), "bonisa-tests-"));
await build({ entryPoints: entries, bundle: true, platform: "node", format: "esm", outdir: out, outExtension: { ".js": ".mjs" }, logLevel: "error" });
const files = readdirSync(out).filter((f) => f.endsWith(".mjs")).map((f) => path.join(out, f));
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
