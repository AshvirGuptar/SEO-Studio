import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Evaluation runner (docs/eval). Not part of `npm test`; see docs/eval/README.md. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./docs/eval/server-only-stub.ts", import.meta.url)),
    },
  },
  test: { include: ["docs/eval/**/*.eval.ts"], environment: "node", testTimeout: 60 * 60 * 1000 },
});
