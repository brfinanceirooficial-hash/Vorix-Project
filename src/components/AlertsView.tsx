import React, { useState } from 'react';
import { User, Transaction, Account, Alert } from '../types';
import { db, collection, addDoc, updateDoc, doc, Timestamp, OperationType, handleStorageError } from '../lib/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  Bell, 
  Sparkles, 
  Loader2, 
  Trash2,
  Check,
  TrendingUp,
  TrendingDown,
  Zap,
  Calendar
} from 'lucide-react';
import { generateProactiveAlerts } from '../lib/alerts';

interface AlertsViewProps {
  user: User;
  alerts: Alert[];
  transactions: Transaction[];
  accounts: Account[];
}

export const AlertsView: React.FC<AlertsViewProps> = ({ user, alerts, transactions, accounts }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAlerts = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      await generateProactiveAlerts(user, accounts, transactions, alerts);
    } catch (error) {
      console.error('Error generating alerts:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const markAsRead = async (alertId: string) => {
    try {
      await updateDoc(doc(db, `users/${user.uid}/alerts`, alertId), {
        read: true
      });
    } catch (error) {
      handleStorageError(error, OperationType.UPDATE, `users/${user.uid}/alerts/${alertId}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6 lg:space-y-12 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-8">
        <div className="space-y-1.5 lg:space-y-4">
          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 lg:px-3 lg:py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <Sparkles className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-orange-500" />
            <span className="text-[8px] lg:text-xs font-bold text-orange-500 uppercase tracking-widest">Inteligência Vorix</span>
          </div>
          <h2 className="text-2xl lg:text-5xl font-black tracking-tight text-white leading-tight">Centro de Alertas</h2>
          <p className="text-zinc-500 text-[10px] lg:text-lg max-w-2xl font-medium leading-relaxed">
            Insights proativos e análises em tempo real para sua evolução financeira.
          </p>
        </div>
        <button 
          onClick={generateAlerts}
          disabled={isGenerating}
          className="w-full lg:w-auto flex items-center justify-center space-x-2 lg:space-x-4 px-5 py-3 lg:px-10 lg:py-5 bg-[#ff4d00] hover:bg-[#e64500] disabled:opacity-50 text-white rounded-xl lg:rounded-3xl text-xs lg:text-lg font-bold transition-all shadow-2xl shadow-[#ff4d00]/30 active:scale-95 group"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 lg:w-6 lg:h-6 animate-spin" />
              <span>Analisando Padrões...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 lg:w-6 lg:h-6 group-hover:rotate-12 transition-transform" />
              <span>Gerar Novos Insights</span>
            </>
          )}
        </button>
      </div>

      {/* Alerts List */}
      <div className="grid grid-cols-1 gap-3 lg:gap-6">
        <AnimatePresence mode="popLayout">
          {alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                key={alert.id}
                className={`group relative overflow-hidden bg-zinc-900/40 backdrop-blur-xl border ${alert.read ? 'border-zinc-800/50 opacity-60' : 'border-zinc-700/50 shadow-2xl shadow-orange-900/5'} p-4 lg:p-10 rounded-2xl lg:rounded-[3rem] transition-all hover:border-zinc-500/50`}
              >
                {/* Status Indicator Bar */}
                {!alert.read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 lg:w-1.5 bg-[#ff4d00] rounded-r-full shadow-[0_0_15px_rgba(255,77,0,0.5)]" />
                )}

                <div className="flex flex-row items-start gap-4 lg:gap-10">
                  <div className={`p-2.5 lg:p-5 rounded-xl lg:rounded-[2rem] bg-zinc-950 border border-zinc-800 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500`}>
                    {React.cloneElement(getIcon(alert.type) as React.ReactElement, { className: 'w-5 h-5 lg:w-7 lg:h-7' })}
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1.5 lg:space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 lg:gap-4">
                      <div className="flex items-center gap-2 lg:gap-4">
                        <h4 className={`font-black text-sm lg:text-2xl tracking-tight truncate ${alert.read ? 'text-zinc-500' : 'text-white'}`}>
                          {alert.title}
                        </h4>
                        <span className={`px-1.5 py-0.5 lg:px-3 lg:py-1 rounded-md lg:rounded-xl text-[7px] lg:text-[11px] font-black uppercase tracking-widest border ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5 lg:space-x-3 text-[8px] lg:text-xs font-bold text-zinc-600 uppercase tracking-widest">
                        <Calendar className="w-3 h-3 lg:w-4 lg:h-4" />
                        <span>{new Date(alert.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <p className="text-zinc-400 text-[10px] lg:text-xl leading-relaxed font-medium">
                      {alert.message}
                    </p>
                    
                    {!alert.read && (
                      <div className="pt-2 lg:pt-6 flex items-center justify-end">
                        <button 
                          onClick={() => markAsRead(alert.id)}
                          className="flex items-center space-x-1.5 lg:space-x-3 px-3 py-1.5 lg:px-6 lg:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg lg:rounded-2xl transition-all text-[9px] lg:text-sm font-black uppercase tracking-widest border border-zinc-700/50 active:scale-95"
                        >
                          <Check className="w-3 h-3 lg:w-5 lg:h-5" />
                          <span>Resolver</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl lg:rounded-[4rem] p-8 lg:p-40 text-center space-y-4 lg:space-y-10"
            >
              <div className="relative mx-auto w-12 h-12 lg:w-40 lg:h-40">
                <div className="absolute inset-0 bg-orange-600/20 blur-xl lg:blur-4xl rounded-full animate-pulse" />
                <div className="relative w-full h-full bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center shadow-2xl">
                  <Bell className="w-6 h-6 lg:w-16 lg:h-16 text-zinc-800" />
                </div>
              </div>
              <div className="space-y-2 lg:space-y-4">
                <h3 className="text-lg lg:text-5xl font-black text-white tracking-tight">Tudo sob controle</h3>
                <p className="text-zinc-500 text-[10px] lg:text-2xl max-w-md mx-auto font-medium leading-relaxed">
                  Seu radar financeiro está limpo. Clique em gerar novos insights para uma análise profunda.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Tips Section */}
      <div className="pt-6 lg:pt-16 space-y-4 lg:space-y-10">
        <div className="flex items-center space-x-3 lg:space-x-6">
          <div className="h-px flex-1 bg-zinc-800/50" />
          <h3 className="text-[8px] lg:text-sm font-black text-zinc-600 uppercase tracking-[0.3em]">Radar de Monitoramento</h3>
          <div className="h-px flex-1 bg-zinc-800/50" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-10">
          {[
            { title: 'Padrões de Gasto', desc: 'Identificamos onde seu dinheiro está "vazando" de forma silenciosa.', icon: TrendingDown },
            { title: 'Contas a Vencer', desc: 'Monitoramento contínuo para evitar juros e multas desnecessárias.', icon: Calendar },
            { title: 'Oportunidades', desc: 'Sugestões inteligentes de investimento baseadas no seu fluxo.', icon: TrendingUp },
          ].map((tip, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -5 }}
              className="bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/50 p-4 lg:p-10 rounded-2xl lg:rounded-[3rem] space-y-2 lg:space-y-6 hover:border-orange-500/30 transition-all group"
            >
              <div className="w-8 h-8 lg:w-20 lg:h-20 bg-orange-600/5 rounded-xl lg:rounded-[1.5rem] flex items-center justify-center border border-orange-600/10 group-hover:bg-orange-600/10 transition-all">
                <tip.icon className="w-4 h-4 lg:w-10 lg:h-10 text-orange-500/40 group-hover:text-orange-500 transition-colors" />
              </div>
              <div className="space-y-1 lg:space-y-3">
                <h4 className="font-black text-zinc-200 text-xs lg:text-2xl tracking-tight">{tip.title}</h4>
                <p className="text-zinc-500 text-[9px] lg:text-lg leading-relaxed font-medium">{tip.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
