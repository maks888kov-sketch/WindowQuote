/** Register SW early in production so push subscription can use it */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const doRegister = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  };

  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister);
  }
}

/** Ensures SW is registered and ready before subscribing to push (production only) */
export async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return null;
  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register("/sw.js");
  }
  return navigator.serviceWorker.ready;
}
