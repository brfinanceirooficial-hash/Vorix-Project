import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, CheckCircle2, X } from 'lucide-react';
import { Mission } from '../types';

interface MissionCelebrationProps {
  mission: Mission | null;
  onClose: () => void;
}

export const MissionCelebration: React.FC<MissionCelebrationProps> = ({ mission, onClose }) => {
  if (!mission) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.5, opacity: 0, y: 100 }}
        className="relative w-full max-w-md bg-zinc-900 border border-orange-500/30 rounded-3xl p-8 text-center shadow-2xl shadow-orange-600/20 overflow-hidden"
      >
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-600/20 blur-[100px] -z-10" />
          
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Icon */}
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 bg-orange-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-orange-600/40"
          >
            <span className="text-5xl">{mission.icon}</span>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">MISSÃO CUMPRIDA!</h2>
            <p className="text-zinc-400 text-lg mb-8">{mission.title}</p>
            
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-zinc-700/50 mb-8">
              <div className="flex items-center justify-center space-x-3 text-orange-500 mb-1">
                <Star className="w-5 h-5 fill-current" />
                <span className="text-sm font-bold uppercase tracking-widest">Recompensa</span>
                <Star className="w-5 h-5 fill-current" />
              </div>
              <div className="text-4xl font-black text-white">
                +{mission.reward} <span className="text-orange-500 text-xl">PONTOS</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center space-x-2 group"
            >
              <span>CONTINUAR EVOLUINDO</span>
              <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          </motion.div>

          {/* Decorative Particles (Simplified) */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0], 
                scale: [0, 1.5, 0],
                x: (Math.random() - 0.5) * 400,
                y: (Math.random() - 0.5) * 400
              }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
              className="absolute top-1/2 left-1/2 w-2 h-2 bg-orange-500 rounded-full"
            />
          ))}
      </motion.div>
    </div>
  );
};
