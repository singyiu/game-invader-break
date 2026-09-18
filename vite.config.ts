import { defineConfig } from "vite";
const contentPolicy =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'";
const headers = {
  "Permissions-Policy": "camera=(self), microphone=()",
  "Content-Security-Policy": contentPolicy,
  "X-Content-Type-Options": "nosniff",
};
export default defineConfig(({ mode }) => ({
  worker: { format: "es" },
  build: {
    target: "es2022",
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
  server: {
    hmr: mode === "test" ? false : undefined,
    headers: {
      ...headers,
      "Content-Security-Policy": contentPolicy.replace(
        "connect-src 'self'",
        "connect-src 'self' ws://127.0.0.1:* ws://localhost:*",
      ),
    },
  },
  preview: { headers },
}));
