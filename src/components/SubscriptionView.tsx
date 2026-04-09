import React, { useState } from 'react';
import { User } from '../types';
import { db, doc, updateDoc, OperationType, handleStorageError } from '../lib/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Gift, 
  QrCode, 
  Copy, 
  Check,
  AlertCircle,
  ShieldCheck,
  Star,
  Trophy,
  Target
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface SubscriptionViewProps {
  user: User;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ user }) => {
  const [coupon, setCoupon] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Mock PIX Key for demonstration
  const pixKey = "00020126330014BR.GOV.BCB.PIX0111123456789015204000053039865802BR5913VORIX FINANCA6009SAO PAULO62070503***6304E2B1";

  const calculateDaysLeft = () => {
    if (!user.trialEndsAt) return 0;
    const end = new Date(user.trialEndsAt.seconds * 1000);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysLeft();

  const handleApplyCoupon = async () => {
    if (!coupon) return;
    setIsApplying(true);
    setCouponError(null);
    setCouponSuccess(null);

    try {
      // Simple mock coupon logic
      const upperCoupon = coupon.toUpperCase();
      if (upperCoupon === 'VORIX30' || upperCoupon === 'BRFINANCEIRO') {
        if (user.couponUsed) {
          setCouponError('Você já utilizou um cupom de desconto.');
        } else {
          const isBrFinanceiro = upperCoupon === 'BRFINANCEIRO';
          const pointsToAdd = isBrFinanceiro ? 100 : 0;
          const daysToAdd = 30;

          const currentTrialEnd = user.trialEndsAt?.toDate() || new Date();
          // Se o trial já expirou, começamos de hoje. Se não, somamos ao atual.
          const baseDate = currentTrialEnd > new Date() ? currentTrialEnd : new Date();
          const newTrialEnd = new Date(baseDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
          
          await updateDoc(doc(db, 'users', user.uid), {
            couponUsed: upperCoupon,
            trialEndsAt: newTrialEnd,
            vorixScore: (user.vorixScore || 0) + pointsToAdd,
            subscriptionStatus: 'trialing'
          });

          setCouponSuccess(`Cupom ${upperCoupon} aplicado! Você ganhou ${daysToAdd} dias e ${pointsToAdd} pontos.`);
        }
      } else {
        setCouponError('Cupom inválido ou expirado.');
      }
    } catch (error) {
      handleStorageError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsApplying(false);
    }
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 lg:space-y-12 pb-20">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
          <ShieldCheck className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Assinatura Premium</span>
        </div>
        <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white">Seu Plano Vorix</h2>
        <p className="text-zinc-500 text-sm lg:text-lg max-w-2xl font-medium">
          Gerencie sua assinatura e aproveite todos os recursos da inteligência artificial financeira.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 lg:p-10 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${user.subscriptionStatus === 'trialing' ? 'bg-orange-500/20 text-orange-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                    {user.subscriptionStatus === 'trialing' ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {user.subscriptionStatus === 'trialing' ? 'Período de Teste' : 'Plano Premium Ativo'}
                    </h3>
                    <p className="text-zinc-500 text-sm font-medium">
                      {user.subscriptionStatus === 'trialing' 
                        ? `Você tem ${daysLeft} dias restantes de acesso total.` 
                        : 'Sua assinatura está em dia.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 rounded-xl">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-white">IA Ilimitada</span>
                  </div>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 rounded-xl">
                    <Star className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-white">Radar Financeiro</span>
                  </div>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-zinc-800 rounded-xl">
                    <Gift className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-white">Relatórios PDF</span>
                  </div>
                </div>
              </div>

              <div className="text-center lg:text-right space-y-1">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Investimento Mensal</p>
                <div className="flex items-baseline justify-center lg:justify-end">
                  <span className="text-orange-500 text-3xl font-black mr-2">R$</span>
                  <span className="text-6xl lg:text-8xl font-black text-white tracking-tighter bg-gradient-to-b from-white via-white to-zinc-600 bg-clip-text text-transparent drop-shadow-2xl">10,99</span>
                </div>
                <div className="flex items-center justify-center lg:justify-end space-x-3 mt-2">
                  <div className="h-[1px] w-12 bg-zinc-800" />
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Renovação Automática</span>
                  <div className="h-[1px] w-12 bg-zinc-800" />
                </div>
              </div>
            </div>

            {/* Progress Bar for Trial */}
            {user.subscriptionStatus === 'trialing' && (
              <div className="mt-10 space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1.5 text-orange-500" />
                    Progresso do Teste
                  </span>
                  <span className="text-white">{30 - daysLeft} / 30 dias</span>
                </div>
                <div className="h-2.5 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((30 - daysLeft) / 30) * 100}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                  />
                </div>
              </div>
            )}

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
          </div>

          {/* Payment Section */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 lg:p-10 space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                <QrCode className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Pagamento via PIX</h3>
                <p className="text-zinc-500 text-sm font-medium">Escaneie o QR Code ou copie a chave para assinar.</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-2xl shadow-white/5">
                {/* Placeholder for QR Code */}
                <div className="w-full h-full bg-zinc-100 rounded-xl flex items-center justify-center border-2 border-dashed border-zinc-300">
                  <QrCode className="w-12 h-12 text-zinc-400" />
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Chave PIX (Copia e Cola)</label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      readOnly 
                      value={pixKey}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-xs font-mono text-zinc-400 pr-12 focus:outline-none focus:border-orange-500/50 transition-all"
                    />
                    <button 
                      onClick={copyPixKey}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Após o pagamento, sua assinatura será ativada automaticamente em até 5 minutos. O valor de <strong>R$ 10,99</strong> será cobrado mensalmente para manter seu acesso premium.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Coupon & Info */}
        <div className="space-y-6">
          {/* Coupon Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <Gift className="w-5 h-5 text-orange-500" />
              <h4 className="text-lg font-black text-white">Cupom de Desconto</h4>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Digite seu cupom"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
              />
              
              <button 
                onClick={handleApplyCoupon}
                disabled={isApplying || !coupon}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-orange-600/20"
              >
                {isApplying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Aplicar Cupom'}
              </button>

              <AnimatePresence mode="wait">
                {couponError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-rose-500 text-xs font-bold text-center"
                  >
                    {couponError}
                  </motion.p>
                )}
                {couponSuccess && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-emerald-500 text-xs font-bold text-center"
                  >
                    {couponSuccess}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-600 font-medium text-center uppercase tracking-widest">
                Dica: Use <span className="text-orange-500 font-black">VORIX30</span> ou <span className="text-orange-500 font-black">BRFINANCEIRO</span> para testar.
              </p>
            </div>
          </div>

          {/* Benefits Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
            <h4 className="text-lg font-black text-white">Benefícios Premium</h4>
            <div className="space-y-4">
              {[
                { icon: Zap, text: 'Consultas ilimitadas com a Vorix IA' },
                { icon: ShieldCheck, text: 'Análise de gastos em tempo real' },
                { icon: Gift, text: 'Relatórios PDF e Excel ilimitados' },
                { icon: Star, text: 'Radar de oportunidades financeiras' },
                { icon: Trophy, text: 'Missões e recompensas exclusivas' },
                { icon: CreditCard, text: 'Categorização automática inteligente' },
                { icon: Target, text: 'Metas financeiras ilimitadas' },
                { icon: Zap, text: 'Acesso antecipado a novas funções' },
                { icon: CheckCircle2, text: 'Suporte prioritário 24/7' },
              ].map((benefit, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center shrink-0">
                    <benefit.icon className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
