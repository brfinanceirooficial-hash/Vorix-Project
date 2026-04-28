import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Smartphone, 
  Apple, 
  Share, 
  PlusSquare, 
  MoreVertical, 
  Download,
  ArrowRight
} from 'lucide-react';

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isOpen, onClose }) => {
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    if (isOpen) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setPlatform('ios');
      } else if (/android/.test(userAgent)) {
        setPlatform('android');
      } else {
        setPlatform('ios');
      }
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl bg-[#0a0a0a] border border-zinc-800/60 rounded-[32px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
          >
            {/* Header / Selector */}
            <div className="p-6 sm:p-8 border-b border-zinc-800/60 flex flex-col items-center relative">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 sm:top-8 sm:right-8 p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 mb-6">
                <Download className="w-8 h-8 text-orange-500" />
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Instale o Vorix</h2>
              <p className="text-zinc-400 text-center text-sm sm:text-base max-w-md mb-8">
                Tenha a experiência completa do aplicativo direto na sua tela inicial, de forma rápida e segura.
              </p>

              <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <button
                  onClick={() => setPlatform('ios')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    platform === 'ios' 
                      ? 'bg-zinc-800 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Apple className="w-4 h-4" />
                  <span>iPhone (iOS)</span>
                </button>
                <button
                  onClick={() => setPlatform('android')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    platform === 'android' 
                      ? 'bg-zinc-800 text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Android</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 bg-zinc-950/50">
              <AnimatePresence mode="wait">
                {platform === 'ios' ? (
                  <motion.div
                    key="ios"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="max-w-2xl mx-auto space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Passo 1 */}
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">1</div>
                        <div className="h-32 w-full flex items-center justify-center mb-4 mt-2">
                          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                            <Share className="w-8 h-8 text-blue-500" />
                          </div>
                        </div>
                        <h4 className="font-bold text-white mb-2">Compartilhar</h4>
                        <p className="text-sm text-zinc-500">Toque no ícone de compartilhar na barra inferior do Safari.</p>
                      </div>

                      {/* Passo 2 */}
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">2</div>
                        <div className="h-32 w-full flex items-center justify-center mb-4 mt-2">
                          <div className="flex flex-col w-full px-4 space-y-2 group-hover:-translate-y-2 transition-transform duration-300">
                            <div className="bg-zinc-800/50 rounded-xl p-3 flex items-center space-x-3 border border-zinc-700/50">
                              <PlusSquare className="w-5 h-5 text-white" />
                              <div className="h-2 w-20 bg-zinc-600 rounded-full"></div>
                            </div>
                            <div className="bg-zinc-800 rounded-xl p-3 flex items-center space-x-3 border border-zinc-600 shadow-lg relative z-10 scale-105">
                              <PlusSquare className="w-5 h-5 text-white" />
                              <span className="text-[10px] font-bold text-white">Adicionar à Tela...</span>
                            </div>
                            <div className="bg-zinc-800/50 rounded-xl p-3 flex items-center space-x-3 border border-zinc-700/50">
                              <div className="w-5 h-5 bg-zinc-700 rounded-md"></div>
                              <div className="h-2 w-16 bg-zinc-600 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        <h4 className="font-bold text-white mb-2">Adicionar</h4>
                        <p className="text-sm text-zinc-500">Role o menu para baixo e selecione "Adicionar à Tela de Início".</p>
                      </div>

                      {/* Passo 3 */}
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">3</div>
                        <div className="h-32 w-full flex items-center justify-center mb-4 mt-2">
                          <div className="w-full h-full bg-zinc-800/30 rounded-2xl border border-zinc-700/50 relative overflow-hidden flex flex-col group-hover:bg-zinc-800/50 transition-colors duration-300">
                            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/80">
                              <span className="text-[10px] text-blue-500">Cancelar</span>
                              <span className="text-[10px] font-bold text-white">Adicionar</span>
                              <span className="text-[10px] text-blue-500 font-bold">Adicionar</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                               <div className="w-12 h-12 bg-orange-600 rounded-xl shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                 <span className="text-white font-bold text-xl">V</span>
                               </div>
                            </div>
                          </div>
                        </div>
                        <h4 className="font-bold text-white mb-2">Confirmar</h4>
                        <p className="text-sm text-zinc-500">Toque em "Adicionar" no canto superior direito para confirmar.</p>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="android"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="max-w-2xl mx-auto space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Passo 1 */}
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">1</div>
                        <div className="h-32 w-full flex items-center justify-center mb-4 mt-2 relative">
                          <div className="w-full max-w-[140px] h-8 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-end px-3">
                             <div className="w-8 h-8 rounded-full hover:bg-zinc-700 flex items-center justify-center group-hover:bg-zinc-700 transition-colors duration-300">
                               <MoreVertical className="w-5 h-5 text-white" />
                             </div>
                          </div>
                        </div>
                        <h4 className="font-bold text-white mb-2">Menu do Navegador</h4>
                        <p className="text-sm text-zinc-500">Toque no ícone de três pontos no canto superior direito do Chrome.</p>
                      </div>

                      {/* Passo 2 */}
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">2</div>
                        <div className="h-32 w-full flex items-center justify-center mb-4 mt-2">
                           <div className="bg-zinc-800 rounded-2xl w-full px-4 py-3 border border-zinc-700 shadow-xl flex flex-col space-y-3 group-hover:-translate-y-2 transition-transform duration-300">
                              <div className="h-2 w-24 bg-zinc-700 rounded-full"></div>
                              <div className="flex items-center space-x-3 bg-zinc-700/50 p-2 rounded-lg relative">
                                <Download className="w-4 h-4 text-white" />
                                <span className="text-[10px] font-bold text-white">Instalar aplicativo</span>
                                <div className="absolute inset-0 border border-orange-500 rounded-lg animate-pulse"></div>
                              </div>
                              <div className="h-2 w-16 bg-zinc-700 rounded-full"></div>
                           </div>
                        </div>
                        <h4 className="font-bold text-white mb-2">Instalar</h4>
                        <p className="text-sm text-zinc-500">No menu, procure e toque em "Instalar aplicativo" ou "Adicionar à tela inicial".</p>
                      </div>

                      {/* Passo 3 */}
                      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute top-4 left-4 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold text-white z-10">3</div>
                        <div className="h-32 w-full flex items-center justify-center mb-4 mt-2">
                           <div className="w-40 bg-zinc-800 rounded-2xl border border-zinc-700 shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-300">
                             <div className="p-4 flex flex-col items-center space-y-2">
                               <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center mb-1">
                                  <span className="text-white font-bold text-lg">V</span>
                               </div>
                               <span className="text-xs text-white font-bold text-center">Instalar app Vorix?</span>
                             </div>
                             <div className="flex border-t border-zinc-700">
                               <div className="flex-1 py-2 text-center border-r border-zinc-700 text-[10px] text-zinc-400">Cancelar</div>
                               <div className="flex-1 py-2 text-center text-[10px] font-bold text-orange-500">Instalar</div>
                             </div>
                           </div>
                        </div>
                        <h4 className="font-bold text-white mb-2">Confirmar</h4>
                        <p className="text-sm text-zinc-500">Confirme a instalação no alerta que aparecer e aguarde.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-zinc-800/60 bg-zinc-900/30 flex justify-center">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors flex items-center space-x-2"
              >
                <span>Entendi, fechar</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
