import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

globalThis.require = createRequire(import.meta.url);

const rootDir = path.dirname(fileURLToPath(import.meta.url));

async function buildServer() {
  const distDir = path.resolve(rootDir, "dist");

  await rm(distDir, {
    recursive: true,
    force: true,
  });

  await esbuild({
    entryPoints: [path.resolve(rootDir, "src/index.ts")],

    outdir: distDir,

    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",

    outExtension: {
      ".js": ".mjs",
    },

    sourcemap: true,
    minify: process.env.NODE_ENV === "production",

    logLevel: "info",

    external: [
      "*.node",
      "pg",
      "pg-native",
      "better-sqlite3",
      "sqlite3",
      "sharp",
      "canvas",
      "bcrypt",
      "argon2",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron"
    ],

    plugins: [
      esbuildPluginPino({
        transports: ["pino-pretty"],
      }),
    ],

    banner: {
      js: `
import { createRequire as __createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.require = __createRequire(import.meta.url);
globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = path.dirname(globalThis.__filename);
`,
    },
  });
}

buildServer().catch((error) => {
  console.error(error);
  process.exit(1);
});