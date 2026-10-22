// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Set only by .github/workflows/deploy-pages.yml, e.g. "/india-fare-inflation-watch/".
// Builds a static single-page app for GitHub Pages; normal/Lovable builds are unchanged.
const pagesBase = process.env.GH_PAGES_BASE;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(pagesBase && { spa: { enabled: true }, router: { basepath: pagesBase } }),
  },
  // node-server lets Start prerender the SPA shell; the workflow publishes only .output/public.
  ...(pagesBase && { nitro: { preset: "node-server" }, vite: { base: pagesBase } }),
});
