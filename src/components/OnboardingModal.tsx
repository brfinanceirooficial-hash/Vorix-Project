import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  LayoutDashboard, 
  Wallet, 
  Zap, 
  Bot, 
  Target,
  ArrowRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { User } from '../types';

interface OnboardingModalProps {
  user: User;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ user, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const slides = [
    {
      title: `Bem-vindo à Vorix, ${user.username.split(' ')[0]}!`,
      description: "Estamos felizes em ter você conosco. Vamos te mostrar rapidamente como dominar suas finanças e alcançar a liberdade financeira.",
      icon: <Sparkles className="w-16 h-16 text-orange-500" />,
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800",
      color: "from-orange-500/20 to-orange-500/5"
    },
    {
      title: "Controle seu Fluxo",
      description: "No Dashboard, você visualiza seu saldo total, entradas e saídas. Tudo de forma automática e inteligente para você não perder nada.",
      icon: <LayoutDashboard className="w-16 h-16 text-blue-500" />,
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
      color: "from-blue-500/20 to-blue-500/5"
    },
    {
      title: "Lançamentos Rápidos",
      description: "Use o botão 'Lançar' para adicionar suas transações. Você pode categorizar tudo para saber exatamente para onde seu dinheiro está indo.",
      icon: <Wallet className="w-16 h-16 text-emerald-500" />,
      image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=800",
      color: "from-emerald-500/20 to-emerald-500/5"
    },
    {
      title: "Radar Preditivo",
      description: "Nosso Radar antecipa seus gastos e avisa sobre spoilers financeiros. Saiba o que vai acontecer com seu dinheiro antes mesmo de gastar.",
      icon: <Zap className="w-16 h-16 text-purple-500" />,
      image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800",
      color: "from-purple-500/20 to-purple-500/5"
    },
    {
      title: "IA Vorix",
      description: "Sua consultora financeira pessoal disponível 24/7. Peça análises, dicas de economia ou tire dúvidas sobre seus investimentos.",
      icon: <Bot className="w-16 h-16 text-indigo-500" />,
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800",
      color: "from-indigo-500/20 to-indigo-500/5"
    },
    {
      title: "Métricas de Sucesso",
      description: "Acompanhe seu Score Vorix e ganhe pontos ao manter hábitos saudáveis. Suba de nível enquanto sua conta bancária também sobe.",
      icon: <TrendingUp className="w-16 h-16 text-rose-500" />,
      image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800",
      color: "from-rose-500/20 to-rose-500/5"
    },
    {
      title: "Está Pronto?",
      description: "Sua jornada rumo à alta performance financeira começa agora. Vamos configurar sua primeira conta?",
      icon: <ShieldCheck className="w-20 h-20 text-orange-500" />,
      image: null,
      color: "from-orange-500/30 to-orange-500/10",
      final: true
    }
  ];

  const handleClose = () => {
    setIsVisible(false);
    onComplete();
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleClose();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[12px]">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl bg-zinc-950/80 border border-zinc-800 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col lg:flex-row min-h-[500px]"
      >
        {/* Left Side: Visuals/Images */}
        <div className={`hidden lg:block w-[40%] bg-gradient-to-br ${slides[currentSlide].color} relative`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center p-12"
            >
              {slides[currentSlide].image ? (
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent z-10 rounded-2xl" />
                  <img 
                    src={slides[currentSlide].image!} 
                    className="w-full h-full object-cover rounded-3xl shadow-2xl border border-white/10"
                    alt="Tutorial"
                  />
                  <div className="absolute bottom-8 left-8 right-8 z-20">
                    <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-white font-bold text-xs">Dica Vorix: {slides[currentSlide].title}</p>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-32 h-32 bg-orange-500/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-500/20 border border-orange-500/30">
                        <Sparkles className="w-16 h-16 text-orange-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white">VORIX ENGINE</h3>
                    <p className="text-zinc-500 text-sm font-medium">Sua conta está configurada e pronta para o próximo nível.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Side: Content */}
        <div className="flex-1 p-8 lg:p-16 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-12">
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-orange-500' : 'w-2 bg-zinc-800'}`} 
                  />
                ))}
              </div>
              <button 
                onClick={handleClose}
                className="p-2 text-zinc-500 hover:text-white transition-colors relative z-[210]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div className="lg:hidden w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 mb-6">
                    {slides[currentSlide].icon}
                </div>
                
                <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                  {slides[currentSlide].title}
                </h2>
                <p className="text-zinc-400 text-lg lg:text-xl leading-relaxed font-medium max-w-xl">
                  {slides[currentSlide].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={nextSlide}
              className={`flex-1 py-5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-[1.5rem] transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-600/20 group uppercase tracking-widest text-sm`}
            >
              <span>{currentSlide === slides.length - 1 ? 'Começar Agora' : 'Próximo Passo'}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {currentSlide > 0 && (
                <button
                    onClick={prevSlide}
                    className="py-5 px-8 border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold rounded-[1.5rem] transition-all text-sm uppercase tracking-widest"
                >
                    Voltar
                </button>
            )}
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-600/10 blur-[100px] -z-10" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/10 blur-[100px] -z-10" />
      </motion.div>
    </div>
  );
};
