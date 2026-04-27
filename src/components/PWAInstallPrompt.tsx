import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share, PlusSquare, X } from 'lucide-react';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    // Verificar se já está instalado (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');

    if (isStandalone) return;

    // Detectar plataforma
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    if (isIos) {
      setPlatform('ios');
      // Mostrar após 5 segundos para não ser intrusivo
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    } else if (isAndroid) {
      setPlatform('android');
      // O Android geralmente mostra o banner nativo, mas podemos avisar também
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-4 right-4 z-[100] bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="bg-orange-600 p-2 rounded-xl">
            <PlusSquare className="text-white w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm">Instalar Vorix</h3>
            <p className="text-zinc-400 text-xs mt-1">
              {platform === 'ios' ? (
                <>Toque no ícone de <Share className="inline w-3 h-3 mx-1" /> compartilhar e depois em <b>'Adicionar à Tela de Início'</b> para ter o app sempre à mão.</>
              ) : (
                "Adicione o Vorix à sua tela inicial para acesso rápido e melhor experiência."
              )}
            </p>
          </div>
          <button 
            onClick={() => setShowPrompt(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
