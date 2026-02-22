import React, { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    // Android / Chrome install prompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari tip
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches;
    if (isIos && !isInStandaloneMode) {
      setShowIosTip(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIosTip(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (!showBanner && !showIosTip) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-area-bottom">
      <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">Установить Romchi</p>
            {showIosTip ? (
              <p className="text-sm text-gray-500 mt-1">
                Нажмите <span className="font-medium">«Поделиться»</span> → <span className="font-medium">«На экран домой»</span> для установки
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                Установите приложение на телефон для быстрого доступа
              </p>
            )}
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>
        {!showIosTip && (
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleDismiss}>
              Не сейчас
            </Button>
            <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleInstall}>
              <Download className="w-4 h-4 mr-1" />
              Установить
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}