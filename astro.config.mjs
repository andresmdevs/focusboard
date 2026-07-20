// @ts-check
import { defineConfig } from "astro/config";

// Focusboard es una app estática (client-side + localStorage), ideal para
// Firebase Hosting servido en la raíz "/". No se necesita `base`.
// Cuando conozcas la URL final de Firebase puedes descomentar `site`.
export default defineConfig({
  // site: "https://TU-PROYECTO.web.app",
  build: {
    // Assets con hash bajo /_astro (cacheables a largo plazo en Firebase).
    assets: "_astro",
  },
});
