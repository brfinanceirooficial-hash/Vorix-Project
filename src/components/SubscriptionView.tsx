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
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'premium'>('pro');

  const plans = {
    trial: {
      name: 'Teste Grátis',
      price: '0,00',
      period: '30 dias',
      features: [
        '1 Conta Bancária',
        '2 Notas/Anotações',
        'Radar com Spoiler (Blur)',
        '2 Relatórios Totais',
        'IA Vorix Básica',
      ],
      color: 'zinc',
      icon: Clock
    },
    pro: {
      name: 'Plano Pro',
      price: '10,99',
      period: 'por mês',
      features: [
        '3 Contas Bancárias',
        'Anotações Ilimitadas',
        'Radar Completo',
        '1 Relatório por Semana',
        '10 Consultas IA/dia',
      ],
      color: 'orange',
      icon: Zap
    },
    premium: {
      name: 'Plano Premium',
      price: '17,99',
      period: 'por mês',
      features: [
        'Contas Ilimitadas',
        'IA Ilimitada',
        'Radar Completo',
        'Relatórios Ilimitados (PDF)',
        'Suporte Prioritário',
        'Missões Exclusivas',
      ],
      color: 'emerald',
      icon: Star
    }
  };

  // Mock PIX Key for demonstration - would change based on plan
  const pixKey = selectedPlan === 'pro' 
    ? "00020126330014BR.GOV.BCB.PIX0111123456789015204000053039865802BR5913VORIX PRO10996009SAO PAULO62070503***6304E2B1"
    : "00020126330014BR.GOV.BCB.PIX0111123456789015204000053039865802BR5913VORIX PRE17996009SAO PAULO62070503***6304D1A2";

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
      const upperCoupon = coupon.trim().toUpperCase();
      if (upperCoupon === 'VORIX30' || upperCoupon === 'BRFINANCEIRO') {
        if (user.couponUsed) {
          setCouponError('Você já utilizou um cupom de desconto.');
        } else {
          const isBrFinanceiro = upperCoupon === 'BRFINANCEIRO';
          const pointsToAdd = isBrFinanceiro ? 100 : 0;
          const daysToAdd = 30;

          const currentTrialEnd = user.trialEndsAt?.toDate() || new Date();
          const baseDate = currentTrialEnd > new Date() ? currentTrialEnd : new Date();
          const newTrialEnd = new Date(baseDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
          
          await updateDoc(doc(db, 'users', user.uid), {
            couponUsed: upperCoupon,
            trialEndsAt: newTrialEnd,
            vorixScore: (user.vorixScore || 0) + pointsToAdd,
            subscriptionStatus: 'trialing',
            plan: 'trial'
          });

          setCouponSuccess(`Cupom ${upperCoupon} aplicado! Você ganhou ${daysToAdd} dias de Teste.`);
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
          <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Planos & Assinatura</span>
        </div>
        <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white">Escolha sua Evolução</h2>
        <p className="text-zinc-500 text-sm lg:text-lg max-w-2xl font-medium">
          Selecione o plano ideal para seu momento financeiro e acelere sua jornada rumo à liberdade.
        </p>
      </div>

      {/* Subscription Status Bar */}
      {user.subscriptionStatus === 'trialing' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group">
          <div className="flex items-center space-x-4 relative z-10">
            <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold">Você está no Período de Teste</h3>
              <p className="text-zinc-500 text-sm">{daysLeft} dias restantes • {user.reportsCount || 0}/2 relatórios usados</p>
            </div>
          </div>
          <div className="flex-1 max-w-md relative z-10">
            <div className="h-2.5 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${((30 - daysLeft) / 30) * 100}%` }}
                className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
              />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
        </div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trial Card */}
        <div className={`bg-zinc-900/50 border ${user.plan === 'trial' || !user.plan ? 'border-zinc-700' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden transition-all hover:border-zinc-700`}>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xl font-black text-white">{plans.trial.name}</h4>
              <div className="flex items-baseline mt-1">
                <span className="text-2xl font-black text-white">R$ {plans.trial.price}</span>
                <span className="text-zinc-500 text-xs font-bold ml-1 uppercase">{plans.trial.period}</span>
              </div>
            </div>
          </div>
          <ul className="space-y-4">
            {plans.trial.features.map((f, i) => (
              <li key={i} className="flex items-center space-x-3 text-sm text-zinc-500 font-medium">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {user.plan === 'trial' || !user.plan ? (
            <div className="w-full py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black text-center text-sm border border-zinc-700">Plano Atual</div>
          ) : (
             <div className="w-full py-4 bg-zinc-900/50 text-zinc-700 rounded-2xl font-black text-center text-sm border border-zinc-800/10">Indisponível</div>
          )}
        </div>

        {/* Pro Card */}
        <div 
          onClick={() => setSelectedPlan('pro')}
          className={`bg-zinc-900/50 border-2 ${selectedPlan === 'pro' ? 'border-orange-500' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer group`}
        >
          {selectedPlan === 'pro' && (
            <div className="absolute top-4 right-6 px-3 py-1 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-orange-500/20">Popular</div>
          )}
          <div className="space-y-4">
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500/20 transition-all">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xl font-black text-white">{plans.pro.name}</h4>
              <div className="flex items-baseline mt-1">
                <span className="text-2xl font-black text-white">R$ {plans.pro.price}</span>
                <span className="text-zinc-500 text-xs font-bold ml-1 uppercase">{plans.pro.period}</span>
              </div>
            </div>
          </div>
          <ul className="space-y-4">
            {plans.pro.features.map((f, i) => (
              <li key={i} className="flex items-center space-x-3 text-sm text-white font-medium">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className={`w-full py-4 ${selectedPlan === 'pro' ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400'} rounded-2xl font-black text-center text-sm transition-all`}>
            {selectedPlan === 'pro' ? 'Selecionado' : 'Selecionar'}
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full" />
        </div>

        {/* Premium Card */}
        <div 
          onClick={() => setSelectedPlan('premium')}
          className={`bg-zinc-900/50 border-2 ${selectedPlan === 'premium' ? 'border-emerald-500' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden transition-all hover:scale-[1.02] cursor-pointer group`}
        >
          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-all">
              <Star className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xl font-black text-white">{plans.premium.name}</h4>
              <div className="flex items-baseline mt-1">
                <span className="text-2xl font-black text-white">R$ {plans.premium.price}</span>
                <span className="text-zinc-500 text-xs font-bold ml-1 uppercase">{plans.premium.period}</span>
              </div>
            </div>
          </div>
          <ul className="space-y-4">
            {plans.premium.features.map((f, i) => (
              <li key={i} className="flex items-center space-x-3 text-sm text-white font-medium">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className={`w-full py-4 ${selectedPlan === 'premium' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'} rounded-2xl font-black text-center text-sm transition-all`}>
            {selectedPlan === 'premium' ? 'Selecionado' : 'Selecionar'}
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
        </div>
      </div>

      {/* Payment Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 lg:p-10 space-y-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                <QrCode className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Pagamento via PIX</h3>
                <p className="text-zinc-500 text-sm font-medium">Assine o plano <span className="text-white font-bold uppercase">{selectedPlan}</span> agora mesmo.</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-48 h-48 bg-white p-4 rounded-3xl shadow-2xl shadow-white/5 shrink-0">
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
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-[10px] font-mono text-zinc-400 pr-12 focus:outline-none focus:border-orange-500/50 transition-all truncate"
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
                    Pague <strong>R$ {plans[selectedPlan].price}</strong> para ativar seu acesso {selectedPlan}. A ativação é feita em até 5 minutos após o processamento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Coupon Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <Gift className="w-5 h-5 text-orange-500" />
              <h4 className="text-lg font-black text-white">Cupom</h4>
            </div>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="BRFINANCEIRO"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.trim().toUpperCase())}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
              />
              <button 
                onClick={handleApplyCoupon}
                disabled={isApplying || !coupon}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm transition-all"
              >
                {isApplying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Aplicar'}
              </button>
              <AnimatePresence mode="wait">
                {couponError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 text-[10px] font-bold text-center">{couponError}</motion.p>}
                {couponSuccess && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-500 text-[10px] font-bold text-center">{couponSuccess}</motion.p>}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-4">
            <div className="flex items-center space-x-2 text-zinc-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Pagamento Seguro</span>
            </div>
            <p className="text-zinc-500 text-[10px] leading-relaxed">Sua transação é protegida por criptografia de ponta a ponta e processada via PIX de forma instantânea.</p>
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
