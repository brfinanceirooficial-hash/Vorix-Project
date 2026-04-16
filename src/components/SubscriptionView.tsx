import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  RefreshCw,
  ChevronRight,
  Lock,
  User as UserIcon,
  Calendar,
  Hash,
} from 'lucide-react';

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: any) => any;
  }
}

interface SubscriptionViewProps {
  user: User;
}

const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ user }) => {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'premium'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardDocType, setCardDocType] = useState('CPF');
  const [cardDocNumber, setCardDocNumber] = useState('');
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);

  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixStatus, setPixStatus] = useState<'idle' | 'pending' | 'approved' | 'error'>('idle');
  const pixPollingRef = useRef<any>(null);

  const [coupon, setCoupon] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);


  const mpRef = useRef<any>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const getMPInstance = (): any | null => {
    if (mpRef.current) return mpRef.current;
    try {
      const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
      if (!publicKey) return null;
      if (typeof window !== 'undefined' && window.MercadoPago) {
        mpRef.current = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        return mpRef.current;
      }
    } catch (err) {
      console.error('Erro ao inicializar MercadoPago SDK:', err);
      setSdkError('SDK do Mercado Pago com erro. Recarregue a página.');
    }
    return null;
  };

  useEffect(() => {
    return () => {
      if (pixPollingRef.current) clearInterval(pixPollingRef.current);
    };
  }, []);

  const plans = {
    trial: {
      name: 'Teste Grátis',
      price: '0,00',
      period: '30 dias',
      features: ['1 Conta Bancária', '2 Notas/Anotações', 'Radar com Spoiler (Blur)', '2 Relatórios Totais', 'IA Vorix Básica'],
    },
    pro: {
      name: 'Plano Pro',
      price: '10,99',
      period: 'por mês',
      priceNum: 10.99,
      features: ['3 Contas Bancárias', 'Anotações Ilimitadas', 'Radar Completo', '1 Relatório por Semana', '10 Consultas IA/dia'],
    },
    premium: {
      name: 'Plano Premium',
      price: '17,99',
      period: 'por mês',
      priceNum: 17.99,
      features: ['Contas Ilimitadas', 'IA Ilimitada', 'Radar Completo', 'Relatórios Ilimitados (PDF)', 'Suporte Prioritário', 'Missões Exclusivas'],
    },
  };

  const calculateDaysLeft = () => {
    if (!user.trialEndsAt) return 0;
    const end = new Date(user.trialEndsAt.seconds * 1000);
    const diff = end.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysLeft();

  const handleApplyCoupon = async () => {
    if (!coupon) return;
    setIsApplying(true);
    setCouponError(null);
    setCouponSuccess(null);
    try {
      const upper = coupon.trim().toUpperCase();
      if (upper === 'VORIX30' || upper === 'BRFINANCEIRO') {
        if (user.couponUsed) {
          setCouponError('Você já utilizou um cupom.');
        } else {
          const points = upper === 'BRFINANCEIRO' ? 100 : 0;
          const base = user.trialEndsAt?.toDate() || new Date();
          const newEnd = new Date(Math.max(base.getTime(), new Date().getTime()) + 30 * 24 * 60 * 60 * 1000);
          await updateDoc(doc(db, 'users', user.uid), {
            couponUsed: upper,
            trialEndsAt: newEnd,
            vorixScore: (user.vorixScore || 0) + points,
            subscriptionStatus: 'trialing',
            plan: 'trial',
          });
          setCouponSuccess(`Cupom ${upper} aplicado! +30 dias${points > 0 ? ` e +${points} pontos` : ''}.`);
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

  const handleCardPayment = async () => {
    setCardError(null);
    setIsProcessingCard(true);
    try {
      const mp = getMPInstance();
      if (!mp) throw new Error(sdkError || 'SDK do Mercado Pago não disponível. Recarregue a página.');

      const [expMonth, expYear] = cardExpiry.split('/');
      const rawCard = cardNumber.replace(/\s/g, '');
      if (rawCard.length < 13) throw new Error('Número de cartão inválido.');
      if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 2)
        throw new Error('Data de validade inválida. Use MM/AA.');
      if (cardCvv.length < 3) throw new Error('CVV inválido.');
      if (!cardDocNumber) throw new Error('Informe seu CPF/CNPJ.');

      const tokenResponse = await mp.createCardToken({
        cardNumber: rawCard,
        cardholderName: cardName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYear,
        securityCode: cardCvv,
        identificationType: cardDocType,
        identificationNumber: cardDocNumber.replace(/\D/g, ''),
      });

      if (!tokenResponse?.id) throw new Error('Falha ao gerar token do cartão. Verifique os dados.');

      const response = await fetch('/api/checkout/card-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardToken: tokenResponse.id,
          planId: selectedPlan,
          userId: user.uid,
          userEmail: user.email,
          payerName: cardName,
          identificationNumber: cardDocNumber.replace(/\D/g, ''),
          identificationType: cardDocType,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Pagamento recusado.');

      if (data.status === 'authorized') {
        // Failsafe: Atualiza o doc localmente caso o webhook demore
        await updateDoc(doc(db, 'users', user.uid), {
          plan: selectedPlan,
          subscriptionStatus: 'active',
          isPaid: true,
          trialEndsAt: null
        });
        setCardSuccess(true);
        setTimeout(() => { window.location.href = `/?status=success&plan=${selectedPlan}`; }, 1500);
      } else {
        setCardError(`Pagamento em análise (${data.status}). Aguarde a confirmação.`);
      }
    } catch (error: any) {
      setCardError(error.message || 'Erro ao processar pagamento.');
    } finally {
      setIsProcessingCard(false);
    }
  };

  const handleGeneratePix = async () => {
    setIsGeneratingPix(true);
    setPixStatus('idle');
    setPixQrBase64(null);
    setPixQrCode(null);
    if (pixPollingRef.current) clearInterval(pixPollingRef.current);

    try {
      const response = await fetch('/api/checkout/pix-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          userId: user.uid,
          userEmail: user.email,
          payerFirstName: user.username?.split(' ')[0] || 'Cliente',
          payerLastName: user.username?.split(' ').slice(1).join(' ') || 'Vorix',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao gerar PIX');

      setPixQrBase64(data.qrCodeBase64);
      setPixQrCode(data.qrCode);
      setPixStatus('pending');

      pixPollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/checkout/pix-status/${data.paymentId}`);
          const s = await res.json();
          if (s.status === 'approved') {
            clearInterval(pixPollingRef.current);
            // Failsafe: Atualiza o doc localmente caso o webhook demore
            await updateDoc(doc(db, 'users', user.uid), {
              plan: selectedPlan,
              subscriptionStatus: 'active',
              isPaid: true,
              trialEndsAt: null
            });
            setPixStatus('approved');
            setTimeout(() => { window.location.href = `/?status=success&plan=${selectedPlan}`; }, 2000);
          } else if (s.status === 'cancelled' || s.status === 'rejected') {
            clearInterval(pixPollingRef.current);
            setPixStatus('error');
          }
        } catch {}
      }, 5000);
    } catch (error: any) {
      setPixStatus('error');
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const copyPixCode = () => {
    if (!pixQrCode) return;
    navigator.clipboard.writeText(pixQrCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };


  const isSubscribed = user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial';

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA: Assinante Ativo (early return — não renderiza nada mais abaixo)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isSubscribed) {
    const isPremium = user.plan === 'premium';
    const planFeatures = isPremium ? plans.premium.features : plans.pro.features;
    const planPrice = isPremium ? '17,99' : '10,99';

    return (
      <div className="space-y-8 lg:space-y-10 pb-20">
        {/* Header */}
        <div className="space-y-3">
          <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full border ${isPremium ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Minha Assinatura</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-black tracking-tight text-white">Sua conta está ativa 🎉</h2>
          <p className="text-zinc-500 text-sm lg:text-base max-w-xl font-medium">
            Você tem acesso completo a todos os recursos do seu plano.
          </p>
        </div>

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative rounded-[2.5rem] p-10 overflow-hidden border ${
            isPremium
              ? 'bg-gradient-to-br from-emerald-950/60 to-zinc-900/80 border-emerald-500/30'
              : 'bg-gradient-to-br from-orange-950/60 to-zinc-900/80 border-orange-500/30'
          }`}
        >
          <div className={`absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-20 ${isPremium ? 'bg-emerald-500' : 'bg-orange-500'}`} />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border ${isPremium ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-orange-500/20 border-orange-500/40 text-orange-400'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Assinatura Ativa</span>
              </div>

              <div>
                <p className="text-zinc-400 text-sm font-medium mb-1">Seu plano atual</p>
                <h3 className={`text-4xl lg:text-5xl font-black ${isPremium ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {isPremium ? 'Premium' : 'Pro'}
                </h3>
                <p className="text-zinc-500 text-sm mt-2">R$ {planPrice}/mês • Renovação automática mensal</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900/60 rounded-full border border-zinc-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pagamento Seguro</span>
                </div>
                <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900/60 rounded-full border border-zinc-800">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Acesso Total</span>
                </div>
              </div>
            </div>

            <div className={`w-32 h-32 rounded-3xl flex items-center justify-center shrink-0 ${isPremium ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
              {isPremium
                ? <Star className="w-16 h-16 text-emerald-400 fill-emerald-400/30" />
                : <Zap className="w-16 h-16 text-orange-400 fill-orange-400/30" />
              }
            </div>
          </div>
        </motion.div>

        {/* Grid: Benefícios + Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Benefícios */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-8 space-y-6"
          >
            <h4 className="text-white font-black text-lg">Seus Benefícios Incluídos</h4>
            <ul className="space-y-4">
              {planFeatures.map((f, i) => (
                <li key={i} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isPremium ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
                    <Check className={`w-3.5 h-3.5 ${isPremium ? 'text-emerald-400' : 'text-orange-400'}`} />
                  </div>
                  <span className="text-white font-medium text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Info + Cupom */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-4"
            >
              <h4 className="text-white font-black">Informações da Assinatura</h4>
              <div className="space-y-3 divide-y divide-zinc-800/60">
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-500 text-sm">Status</span>
                  <span className="flex items-center space-x-1.5 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /><span>Ativa</span>
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-500 text-sm">Plano</span>
                  <span className={`font-black text-sm ${isPremium ? 'text-emerald-400' : 'text-orange-400'}`}>
                    {isPremium ? 'Premium' : 'Pro'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-500 text-sm">Valor mensal</span>
                  <span className="text-white font-bold text-sm">R$ {planPrice}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-500 text-sm">Renovação</span>
                  <span className="text-white font-bold text-sm">Automática</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-3"
            >
              <h4 className="text-white font-black text-sm">Gerenciamento Seguro</h4>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Sua assinatura é processada de forma segura. O gerenciamento detalhado e cancelamento podem ser realizados na aba Configurações.
              </p>
              <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                <p className="text-[10px] text-zinc-600">🔒 Cobranças gerenciadas pelo Mercado Pago · PCI-DSS nível 1</p>
              </div>
            </motion.div>

            {!user.couponUsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-6 space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <Gift className="w-4 h-4 text-orange-500" />
                  <h4 className="text-white font-black text-sm">Cupom de Pontos</h4>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="BRFINANCEIRO"
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.trim().toUpperCase())}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 transition-all"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isApplying || !coupon}
                    className="px-4 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all"
                  >
                    {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {couponError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 text-xs font-bold">{couponError}</motion.p>}
                  {couponSuccess && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-500 text-xs font-bold">{couponSuccess}</motion.p>}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TELA: Não-Assinante (trial ou expirado)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
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

      {/* Trial Status Bar */}
      {user.plan === 'trial' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-center space-x-4 relative z-10">
            <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-500">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold">Você está no Período de Teste</h3>
              <p className="text-zinc-500 text-sm">
                {daysLeft > 0 ? `${daysLeft} dias restantes` : 'Trial expirado'} • {user.reportsCount || 0}/2 relatórios usados
              </p>
            </div>
          </div>
          <div className="flex-1 max-w-md relative z-10">
            <div className="h-2.5 bg-zinc-950 border border-zinc-800 rounded-full overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((30 - daysLeft) / 30) * 100)}%` }}
                className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
              />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
        </div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Trial */}
        <div className={`bg-zinc-900/50 border ${!user.plan || user.plan === 'trial' ? 'border-zinc-700' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden`}>
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
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /><span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="w-full py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black text-center text-sm border border-zinc-700">
            {!user.plan || user.plan === 'trial' ? 'Plano Atual' : 'Período Inicial'}
          </div>
        </div>

        {/* Pro */}
        <div
          onClick={() => setSelectedPlan('pro')}
          className={`bg-zinc-900/50 border-2 ${selectedPlan === 'pro' ? 'border-orange-500' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden hover:scale-[1.02] cursor-pointer transition-all group`}
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
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /><span>{f}</span>
              </li>
            ))}
          </ul>
          <div className={`w-full py-4 ${selectedPlan === 'pro' ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400'} rounded-2xl font-black text-center text-sm transition-all`}>
            {selectedPlan === 'pro' ? 'Selecionado' : 'Selecionar'}
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full" />
        </div>

        {/* Premium */}
        <div
          onClick={() => setSelectedPlan('premium')}
          className={`bg-zinc-900/50 border-2 ${selectedPlan === 'premium' ? 'border-emerald-500' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden hover:scale-[1.02] cursor-pointer transition-all group`}
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
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /><span>{f}</span>
              </li>
            ))}
          </ul>
          <div className={`w-full py-4 ${selectedPlan === 'premium' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'} rounded-2xl font-black text-center text-sm transition-all`}>
            {selectedPlan === 'premium' ? 'Selecionado' : 'Selecionar'}
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
        </div>
      </div>

      {/* Checkout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 lg:p-10 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white">
                  Assinar <span className={selectedPlan === 'pro' ? 'text-orange-400' : 'text-emerald-400'}>{plans[selectedPlan].name}</span>
                </h3>
                <p className="text-zinc-500 text-sm mt-1">
                  R$ <span className="font-black text-white">{plans[selectedPlan].price}</span>/mês • Cobrado automaticamente
                </p>
              </div>
              <div className={`px-4 py-2 rounded-2xl text-sm font-black ${selectedPlan === 'pro' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                R$ {plans[selectedPlan].price}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-zinc-950 rounded-2xl p-1 gap-1">
              <button
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${paymentMethod === 'card' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <CreditCard className="w-4 h-4" />Cartão de Crédito
              </button>
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${paymentMethod === 'pix' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <QrCode className="w-4 h-4" />PIX
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* ── CARTÃO ── */}
              {paymentMethod === 'card' && (
                <motion.div key="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                  {cardSuccess ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-emerald-400 font-black">Assinatura ativada com sucesso!</p>
                        <p className="text-zinc-400 text-sm">Redirecionando...</p>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Número do Cartão</label>
                        <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input type="text" inputMode="numeric" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} maxLength={19}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Nome no Cartão</label>
                        <div className="relative">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input type="text" placeholder="NOME COMO NO CARTÃO" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-bold text-sm uppercase placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Validade</label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input type="text" inputMode="numeric" placeholder="MM/AA" value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))} maxLength={5}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">CVV</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input type="password" inputMode="numeric" placeholder="•••" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">CPF do Titular</label>
                        <div className="flex gap-3">
                          <select value={cardDocType} onChange={(e) => setCardDocType(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 text-white text-sm focus:outline-none focus:border-orange-500/60 transition-all w-28">
                            <option value="CPF">CPF</option>
                            <option value="CNPJ">CNPJ</option>
                          </select>
                          <div className="relative flex-1">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input type="text" inputMode="numeric" placeholder={cardDocType === 'CPF' ? '000.000.000-00' : '00.000.000/0001-00'}
                              value={cardDocNumber} onChange={(e) => setCardDocNumber(e.target.value.replace(/\D/g, '').slice(0, cardDocType === 'CPF' ? 11 : 14))}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all" />
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {cardError && (
                          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            <p className="text-rose-400 text-sm">{cardError}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button onClick={handleCardPayment} disabled={isProcessingCard}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 ${
                          selectedPlan === 'pro'
                            ? 'bg-gradient-to-r from-orange-600 to-orange-500 shadow-lg shadow-orange-600/20 hover:shadow-orange-600/40'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40'
                        } text-white hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}>
                        {isProcessingCard
                          ? <><Loader2 className="w-5 h-5 animate-spin" />Processando...</>
                          : <><Lock className="w-4 h-4" />Assinar por R$ {plans[selectedPlan].price}/mês<ChevronRight className="w-4 h-4" /></>
                        }
                      </button>
                      <p className="text-center text-[10px] text-zinc-600">🔒 Pagamento protegido por criptografia • Cancelamento a qualquer momento</p>
                    </>
                  )}
                </motion.div>
              )}

              {/* ── PIX ── */}
              {paymentMethod === 'pix' && (
                <motion.div key="pix" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  {pixStatus === 'idle' && (
                    <div className="text-center space-y-6 py-4">
                      <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto">
                        <QrCode className="w-10 h-10 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-white font-bold">Pague R$ {plans[selectedPlan].price} via PIX</p>
                        <p className="text-zinc-500 text-sm mt-1">Clique para gerar o QR Code. Acesso liberado em segundos após pagamento.</p>
                      </div>
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-left">
                        <p className="text-amber-400 text-xs font-bold mb-1">⚠️ PIX é cobrança única</p>
                        <p className="text-zinc-500 text-xs">O PIX ativa seu plano por 30 dias. Para renovação automática, use cartão.</p>
                      </div>
                      <button onClick={handleGeneratePix} disabled={isGeneratingPix}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                        {isGeneratingPix ? <><Loader2 className="w-5 h-5 animate-spin" />Gerando PIX...</> : <><QrCode className="w-5 h-5" />Gerar QR Code</>}
                      </button>
                    </div>
                  )}

                  {pixStatus === 'pending' && pixQrBase64 && (
                    <div className="space-y-5">
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="w-52 h-52 bg-white p-3 rounded-3xl shadow-2xl shrink-0">
                          <img src={`data:image/png;base64,${pixQrBase64}`} alt="QR Code PIX" className="w-full h-full rounded-xl" />
                        </div>
                        <div className="flex-1 w-full space-y-4">
                          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                            <span className="text-sm">⏳</span>
                            <p className="text-amber-400 text-xs font-bold">Aguardando pagamento... Verificando a cada 5 segundos.</p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">PIX Copia e Cola</label>
                            <div className="relative">
                              <input type="text" readOnly value={pixQrCode || ''}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-[10px] font-mono text-zinc-400 pr-12 focus:outline-none truncate" />
                              <button onClick={copyPixCode} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all">
                                {pixCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <button onClick={handleGeneratePix} className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-all">
                            <RefreshCw className="w-3 h-3" />Gerar novo QR Code
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {pixStatus === 'approved' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
                      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-emerald-400 font-black text-xl">Pagamento Confirmado!</p>
                        <p className="text-zinc-400 text-sm mt-1">Seu plano foi ativado. Redirecionando...</p>
                      </div>
                    </motion.div>
                  )}

                  {pixStatus === 'error' && (
                    <div className="text-center py-6 space-y-4">
                      <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
                      <p className="text-rose-400 font-bold">Erro ao gerar PIX. Tente novamente.</p>
                      <button onClick={() => setPixStatus('idle')} className="px-6 py-3 bg-zinc-800 text-white rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all">
                        Tentar novamente
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sidebar: Cupom + Segurança */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <Gift className="w-5 h-5 text-orange-500" />
              <h4 className="text-lg font-black text-white">Cupom</h4>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="BRFINANCEIRO" value={coupon} onChange={(e) => setCoupon(e.target.value.trim().toUpperCase())}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-orange-500 transition-all" />
              <button onClick={handleApplyCoupon} disabled={isApplying || !coupon}
                className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm transition-all">
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
            <div className="space-y-3 text-[10px] text-zinc-500 leading-relaxed">
              <p>🔒 Dados do cartão criptografados e processados pelo Mercado Pago (PCI-DSS nível 1)</p>
              <p>🏛️ Vorix nunca armazena dados do seu cartão</p>
              <p>✅ Cancele quando quiser, sem multa</p>
              <p>🔄 Renovação automática mensal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
