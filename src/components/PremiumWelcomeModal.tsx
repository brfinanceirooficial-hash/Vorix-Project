import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Star, 
  Zap, 
  ShieldCheck, 
  LayoutDashboard, 
  BarChart3, 
  BrainCircuit, 
  Wallet,
  X,
  Target
} from 'lucide-react';
import { User } from '../types';

interface PremiumWelcomeModalProps {
  user: User;
  plan: 'pro' | 'premium';
  onClose: () => void;
}

export const PremiumWelcomeModal: React.FC<PremiumWelcomeModalProps> = ({ user, plan, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const isPremium = plan === 'premium';
  const accentColor = isPremium ? 'emerald' : 'orange';
  const IconMain = isPremium ? Star : Zap;

  const slides = [
    {
      title: `Bem-vindo ao ${isPremium ? 'Premium' : 'Pro'}, ${user.username.split(' ')[0]}!`,
      description: 'Sua conta foi atualizada com sucesso. Agora você tem acesso total a recursos exclusivos para acelerar sua jornada.',
      icon: <IconMain className={`w-16 h-16 text-${accentColor}-400 fill-${accentColor}-400/20`} />,
      content: (
        <div className="mt-8 p-6 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
          <p className="text-zinc-400 text-sm font-medium mb-2 uppercase tracking-widest text-center">Status da Conta</p>
          <div className={`text-4xl font-black text-white text-center`}>
            ATIVADA <span className={`text-${accentColor}-500`}>✓</span>
          </div>
        </div>
      )
    },
    ...(isPremium ? [
      {
        title: 'IA Ilimitada',
        description: 'Chega de limites! Consulte nossa Inteligência Artificial quantas vezes precisar para organizar suas finanças.',
        icon: <BrainCircuit className="w-16 h-16 text-emerald-400" />,
        content: <img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800" className="w-full h-40 object-cover rounded-2xl mt-4" alt="AI" />
      },
      {
        title: 'Relatórios Ilimitados',
        description: 'Gere relatórios detalhados em PDF para WhatsApp e impressão em qualquer período de tempo.',
        icon: <BarChart3 className="w-16 h-16 text-emerald-400" />,
        content: <img src="https://images.unsplash.com/photo-1551288049-bbbda536339a?auto=format&fit=crop&q=80&w=800" className="w-full h-40 object-cover rounded-2xl mt-4" alt="Reports" />
      },
      {
        title: 'Missões Exclusivas',
        description: 'Desbloqueie desafios exclusivos que dão mais pontos e ajudam você a manter o foco.',
        icon: <Target className="w-16 h-16 text-emerald-400" />,
        content: <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800" className="w-full h-40 object-cover rounded-2xl mt-4" alt="Missions" />
      }
    ] : [
      {
        title: 'IA Potencializada',
        description: 'Agora você tem 10 consultas por dia com a IA Vorix para tirar todas as suas dúvidas.',
        icon: <BrainCircuit className="w-16 h-16 text-orange-400" />,
        content: <img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800" className="w-full h-40 object-cover rounded-2xl mt-4" alt="AI" />
      },
      {
        title: 'Radar Completo',
        description: 'Visualize todos os spoilers e previsões do seu radar sem nenhum bloqueio ou desfoque.',
        icon: <LayoutDashboard className="w-16 h-16 text-orange-400" />,
        content: <img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800" className="w-full h-40 object-cover rounded-2xl mt-4" alt="Radar" />
      },
      {
        title: 'Mais Contas',
        description: 'Conecte até 3 contas bancárias diferentes para ter uma visão mais consolidada do seu patrimônio.',
        icon: <Wallet className="w-16 h-16 text-orange-400" />,
        content: <img src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=800" className="w-full h-40 object-cover rounded-2xl mt-4" alt="Wallet" />
      }
    ]),
    {
      title: 'Tudo Pronto!',
      description: 'Aproveite seu novo patamar financeiro. Estamos felizes em ter você como membro VIP.',
      icon: <CheckCircle2 className={`w-16 h-16 text-${accentColor}-400`} />,
      content: (
        <button
          onClick={onClose}
          className={`w-full mt-8 py-4 bg-${accentColor === 'emerald' ? 'emerald-600' : 'orange-600'} hover:bg-${accentColor === 'emerald' ? 'emerald-500' : 'orange-500'} text-white font-black rounded-2xl transition-all shadow-lg shadow-${accentColor === 'emerald' ? 'emerald-600/30' : 'orange-600/30'} uppercase tracking-widest`}
        >
          Ir para o Dashboard
        </button>
      )
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onClose();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 flex gap-1 px-1 pt-1">
          {slides.map((_, i) => (
            <div key={i} className="flex-1 h-full bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-${accentColor === 'emerald' ? 'emerald-500' : 'orange-500'}`}
                initial={{ width: '0%' }}
                animate={{ width: i <= currentSlide ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 lg:p-12 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center"
            >
              <div className={`p-6 rounded-[2rem] bg-${accentColor === 'emerald' ? 'emerald-500/10' : 'orange-500/10'} mb-8 shadow-xl shadow-black/20`}>
                {slides[currentSlide].icon}
              </div>

              <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 tracking-tight leading-tight">
                {slides[currentSlide].title}
              </h2>
              
              <p className="text-zinc-400 text-lg leading-relaxed max-w-md">
                {slides[currentSlide].description}
              </p>

              <div className="w-full">
                {slides[currentSlide].content}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="mt-12 flex items-center justify-between gap-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`p-4 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-0 disabled:pointer-events-none`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {currentSlide < slides.length - 1 && (
              <button
                onClick={nextSlide}
                className={`flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group`}
              >
                <span>PRÓXIMO</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Background Glow */}
        <div className={`absolute -bottom-20 -left-20 w-80 h-80 bg-${accentColor === 'emerald' ? 'emerald-500' : 'orange-500'}/10 blur-[100px] -z-10`} />
        <div className={`absolute -top-20 -right-20 w-80 h-80 bg-${accentColor === 'emerald' ? 'emerald-500' : 'orange-500'}/10 blur-[100px] -z-10`} />
      </motion.div>
    </div>
  );
};
