// Registro del service worker, compartido por todas las páginas.
//
// Solo en producción: en `astro dev` el SW cachea agresivamente y sirve JS/CSS
// obsoleto tras cada cambio (su scope es "/", así que cubre todo el origen una
// vez instalado).
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", async () => {
    try {
      // updateViaCache: "none" obliga al navegador a revalidar
      // service-worker.js en cada carga en vez de servirlo desde su caché HTTP
      // (Safari lo cachea hasta 24 h): sin esto, un SW viejo puede seguir
      // sirviendo bundles obsoletos durante horas tras un despliegue.
      const registration = await navigator.serviceWorker.register("/service-worker.js", {
        updateViaCache: "none",
      });
      registration.update();
    } catch (err) {
      console.error("No se pudo registrar el service worker:", err);
    }
  });
}
