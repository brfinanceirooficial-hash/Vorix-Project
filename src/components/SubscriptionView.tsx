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

// ── Declaração de tipo para o SDK global ──────────────────
declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: any) => any;
  }
}

interface SubscriptionViewProps {
  user: User;
}

// ── Helpers ───────────────────────────────────────────────
const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({ user }) => {
  // ── Estado do plano selecionado ───────────────────────────
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'premium'>('pro');

  // ── Estado do método de pagamento ────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');

  // ── Estado do formulário de cartão ───────────────────────
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardDocType, setCardDocType] = useState('CPF');
  const [cardDocNumber, setCardDocNumber] = useState('');
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState(false);

  // ── Estado do PIX ─────────────────────────────────────────
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixStatus, setPixStatus] = useState<'idle' | 'pending' | 'approved' | 'error'>('idle');
  const pixPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Estado do cupom ───────────────────────────────────────
  const [coupon, setCoupon] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

  // ── SDK MP ────────────────────────────────────────────────
  const mpRef = useRef<any>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);

  // Função para inicializar o SDK de forma lazy (chamada só quando necessário)
  const getMPInstance = (): any | null => {
    if (mpRef.current) return mpRef.current;
    try {
      const publicKey = import.meta.env.VITE_MP_PUBLIC_KEY;
      if (!publicKey) {
        console.warn('VITE_MP_PUBLIC_KEY não configurada');
        return null;
      }
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

  // Limpar polling ao desmontar
  useEffect(() => {
    return () => {
      if (pixPollingRef.current) clearInterval(pixPollingRef.current);
    };
  }, []);

  // ── Planos ────────────────────────────────────────────────
  const plans = {
    trial: {
      name: 'Teste Grátis',
      price: '0,00',
      period: '30 dias',
      priceNum: 0,
      features: [
        '1 Conta Bancária',
        '2 Notas/Anotações',
        'Radar com Spoiler (Blur)',
        '2 Relatórios Totais',
        'IA Vorix Básica',
      ],
      color: 'zinc',
      icon: Clock,
    },
    pro: {
      name: 'Plano Pro',
      price: '10,99',
      period: 'por mês',
      priceNum: 10.99,
      features: [
        '3 Contas Bancárias',
        'Anotações Ilimitadas',
        'Radar Completo',
        '1 Relatório por Semana',
        '10 Consultas IA/dia',
      ],
      color: 'orange',
      icon: Zap,
    },
    premium: {
      name: 'Plano Premium',
      price: '17,99',
      period: 'por mês',
      priceNum: 17.99,
      features: [
        'Contas Ilimitadas',
        'IA Ilimitada',
        'Radar Completo',
        'Relatórios Ilimitados (PDF)',
        'Suporte Prioritário',
        'Missões Exclusivas',
      ],
      color: 'emerald',
      icon: Star,
    },
  };

  const calculateDaysLeft = () => {
    if (!user.trialEndsAt) return 0;
    const end = new Date(user.trialEndsAt.seconds * 1000);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysLeft = calculateDaysLeft();

  // ── Cupom ─────────────────────────────────────────────────
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
          const newTrialEnd = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          await updateDoc(doc(db, 'users', user.uid), {
            couponUsed: upperCoupon,
            trialEndsAt: newTrialEnd,
            vorixScore: (user.vorixScore || 0) + pointsToAdd,
            subscriptionStatus: 'trialing',
            plan: 'trial',
          });
          setCouponSuccess(`Cupom ${upperCoupon} aplicado! Você ganhou ${daysToAdd} dias.`);
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

  // ── Pagamento com Cartão ──────────────────────────────────
  const handleCardPayment = async () => {
    setCardError(null);
    setIsProcessingCard(true);

    try {
      const mp = getMPInstance();
      if (!mp) throw new Error(sdkError || 'SDK do Mercado Pago não disponível. Verifique sua conexão e recarregue a página.');

      // Extrai mês e ano do campo de validade (MM/YY)
      const [expMonth, expYear] = cardExpiry.split('/');
      const rawCardNumber = cardNumber.replace(/\s/g, '');

      if (rawCardNumber.length < 13) throw new Error('Número de cartão inválido.');
      if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 2)
        throw new Error('Data de validade inválida. Use MM/AA.');
      if (cardCvv.length < 3) throw new Error('CVV inválido.');
      if (!cardDocNumber) throw new Error('Informe seu CPF/CNPJ.');

      // Tokenizar o cartão via MercadoPago.js v2
      const tokenResponse = await mp.createCardToken({
        cardNumber: rawCardNumber,
        cardholderName: cardName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYear,
        securityCode: cardCvv,
        identificationType: cardDocType,
        identificationNumber: cardDocNumber.replace(/\D/g, ''),
      });

      if (!tokenResponse || !tokenResponse.id) {
        throw new Error('Falha ao gerar token do cartão. Verifique os dados e tente novamente.');
      }

      const cardToken = tokenResponse.id;

      // Enviar token para o backend
      const response = await fetch('/api/checkout/card-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardToken,
          planId: selectedPlan,
          userId: user.uid,
          userEmail: user.email,
          payerName: cardName,
          identificationNumber: cardDocNumber.replace(/\D/g, ''),
          identificationType: cardDocType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Pagamento recusado. Verifique os dados do cartão.');
      }

      if (data.status === 'authorized') {
        setCardSuccess(true);
        // Dispara confetti
        setTimeout(() => {
          window.history.replaceState({}, '', `/?status=success&plan=${selectedPlan}`);
          window.location.href = `/?status=success&plan=${selectedPlan}`;
        }, 1500);
      } else {
        setCardError(`Pagamento em análise (${data.status}). Aguarde a confirmação por e-mail.`);
      }
    } catch (error: any) {
      console.error('[card-payment] Erro:', error);
      setCardError(error.message || 'Erro ao processar pagamento.');
    } finally {
      setIsProcessingCard(false);
    }
  };

  // ── PIX — Gerar QR Code ───────────────────────────────────
  const handleGeneratePix = async () => {
    setIsGeneratingPix(true);
    setPixStatus('idle');
    setPixQrBase64(null);
    setPixQrCode(null);
    setPixPaymentId(null);

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
      setPixPaymentId(String(data.paymentId));
      setPixStatus('pending');

      // Iniciar polling para verificar pagamento
      if (pixPollingRef.current) clearInterval(pixPollingRef.current);
      pixPollingRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/checkout/pix-status/${data.paymentId}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'approved') {
            clearInterval(pixPollingRef.current!);
            setPixStatus('approved');
            setTimeout(() => {
              window.location.href = `/?status=success&plan=${selectedPlan}`;
            }, 2000);
          } else if (statusData.status === 'cancelled' || statusData.status === 'rejected') {
            clearInterval(pixPollingRef.current!);
            setPixStatus('error');
          }
        } catch {}
      }, 5000);
    } catch (error: any) {
      console.error('[pix] Erro:', error);
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

  // ── Guard: usuário já é assinante ────────────────────────
  const isAlreadySubscribed = user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial';

  // ── Render ────────────────────────────────────────────────
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

      {/* Subscribed Banner */}
      {isAlreadySubscribed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-6 flex items-center space-x-4"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
          <div>
            <h3 className="text-emerald-400 font-black text-lg">Plano {user.plan?.toUpperCase()} Ativo!</h3>
            <p className="text-zinc-400 text-sm">Sua assinatura está em dia. Aproveite todos os recursos.</p>
          </div>
        </motion.div>
      )}

      {/* Trial Status Bar */}
      {user.subscriptionStatus === 'trialing' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
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
        <div className={`bg-zinc-900/50 border ${!user.plan || user.plan === 'trial' ? 'border-zinc-700' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden transition-all`}>
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
          {!user.plan || user.plan === 'trial' ? (
            <div className="w-full py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black text-center text-sm border border-zinc-700">Plano Atual</div>
          ) : (
            <div className="w-full py-4 bg-zinc-900/50 text-zinc-700 rounded-2xl font-black text-center text-sm border border-zinc-800/10">Período Inicial</div>
          )}
        </div>

        {/* Pro Card */}
        <div
          onClick={() => !isAlreadySubscribed && setSelectedPlan('pro')}
          className={`bg-zinc-900/50 border-2 ${selectedPlan === 'pro' && !isAlreadySubscribed ? 'border-orange-500' : user.plan === 'pro' ? 'border-orange-500/40' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden transition-all ${!isAlreadySubscribed ? 'hover:scale-[1.02] cursor-pointer' : ''} group`}
        >
          {selectedPlan === 'pro' && !isAlreadySubscribed && (
            <div className="absolute top-4 right-6 px-3 py-1 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-orange-500/20">Popular</div>
          )}
          {user.plan === 'pro' && (
            <div className="absolute top-4 right-6 px-3 py-1 bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-500/30">Seu Plano</div>
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
          <div className={`w-full py-4 ${selectedPlan === 'pro' && !isAlreadySubscribed ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400'} rounded-2xl font-black text-center text-sm transition-all`}>
            {user.plan === 'pro' ? 'Plano Ativo ✓' : selectedPlan === 'pro' && !isAlreadySubscribed ? 'Selecionado' : 'Selecionar'}
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full" />
        </div>

        {/* Premium Card */}
        <div
          onClick={() => !isAlreadySubscribed && setSelectedPlan('premium')}
          className={`bg-zinc-900/50 border-2 ${selectedPlan === 'premium' && !isAlreadySubscribed ? 'border-emerald-500' : user.plan === 'premium' ? 'border-emerald-500/40' : 'border-zinc-800'} rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden transition-all ${!isAlreadySubscribed ? 'hover:scale-[1.02] cursor-pointer' : ''} group`}
        >
          {user.plan === 'premium' && (
            <div className="absolute top-4 right-6 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/30">Seu Plano</div>
          )}
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
          <div className={`w-full py-4 ${selectedPlan === 'premium' && !isAlreadySubscribed ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'} rounded-2xl font-black text-center text-sm transition-all`}>
            {user.plan === 'premium' ? 'Plano Ativo ✓' : selectedPlan === 'premium' && !isAlreadySubscribed ? 'Selecionado' : 'Selecionar'}
          </div>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
        </div>
      </div>

      {/* Checkout Section — só exibe se não for assinante */}
      {!isAlreadySubscribed && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 lg:p-10 space-y-8">
              {/* Cabeçalho do checkout */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white">
                    Assinar Plano <span className={selectedPlan === 'pro' ? 'text-orange-400' : 'text-emerald-400'}>{plans[selectedPlan].name}</span>
                  </h3>
                  <p className="text-zinc-500 text-sm mt-1">
                    R$ <span className="font-black text-white">{plans[selectedPlan].price}</span>/mês • Cobrado automaticamente
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-2xl text-sm font-black ${selectedPlan === 'pro' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  R$ {plans[selectedPlan].price}
                </div>
              </div>

              {/* Tabs: Cartão / PIX */}
              <div className="flex bg-zinc-950 rounded-2xl p-1 gap-1">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${paymentMethod === 'card' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <CreditCard className="w-4 h-4" />
                  Cartão de Crédito
                </button>
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${paymentMethod === 'pix' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <QrCode className="w-4 h-4" />
                  PIX
                </button>
              </div>

              {/* ── CARTÃO ── */}
              <AnimatePresence mode="wait">
                {paymentMethod === 'card' && (
                  <motion.div
                    key="card-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    {/* Sucesso */}
                    {cardSuccess && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl"
                      >
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-emerald-400 font-black">Assinatura ativada com sucesso!</p>
                          <p className="text-zinc-400 text-sm">Redirecionando para o dashboard...</p>
                        </div>
                      </motion.div>
                    )}

                    {!cardSuccess && (
                      <>
                        {/* Número do cartão */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Número do Cartão</label>
                          <div className="relative">
                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="0000 0000 0000 0000"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(formatCard(e.target.value))}
                              maxLength={19}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all"
                            />
                          </div>
                        </div>

                        {/* Nome no cartão */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Nome no Cartão</label>
                          <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                              type="text"
                              placeholder="NOME COMO NO CARTÃO"
                              value={cardName}
                              onChange={(e) => setCardName(e.target.value.toUpperCase())}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-bold text-sm uppercase placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all"
                            />
                          </div>
                        </div>

                        {/* Validade + CVV */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Validade</label>
                            <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder="MM/AA"
                                value={cardExpiry}
                                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                                maxLength={5}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">CVV</label>
                            <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                              <input
                                type="password"
                                inputMode="numeric"
                                placeholder="•••"
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                maxLength={4}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Documento */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">CPF do Titular</label>
                          <div className="flex gap-3">
                            <select
                              value={cardDocType}
                              onChange={(e) => setCardDocType(e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 text-white text-sm focus:outline-none focus:border-orange-500/60 transition-all w-28"
                            >
                              <option value="CPF">CPF</option>
                              <option value="CNPJ">CNPJ</option>
                            </select>
                            <div className="relative flex-1">
                              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={cardDocType === 'CPF' ? '000.000.000-00' : '00.000.000/0001-00'}
                                value={cardDocNumber}
                                onChange={(e) => setCardDocNumber(e.target.value.replace(/\D/g, '').slice(0, cardDocType === 'CPF' ? 11 : 14))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-11 pr-5 py-4 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none focus:border-orange-500/60 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Erro */}
                        <AnimatePresence mode="wait">
                          {cardError && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl"
                            >
                              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                              <p className="text-rose-400 text-sm">{cardError}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Botão Pagar */}
                        <button
                          onClick={handleCardPayment}
                          disabled={isProcessingCard}
                          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 ${selectedPlan === 'pro' ? 'bg-gradient-to-r from-orange-600 to-orange-500 shadow-lg shadow-orange-600/20 hover:shadow-orange-600/40' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/40'} text-white hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:-translate-y-0`}
                        >
                          {isProcessingCard ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <Lock className="w-4 h-4" />
                              Assinar por R$ {plans[selectedPlan].price}/mês
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>

                        <p className="text-center text-[10px] text-zinc-600">
                          🔒 Pagamento protegido por criptografia • Cancelamento a qualquer momento
                        </p>
                      </>
                    )}
                  </motion.div>
                )}

                {/* ── PIX ── */}
                {paymentMethod === 'pix' && (
                  <motion.div
                    key="pix-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Estado inicial — botão de gerar */}
                    {pixStatus === 'idle' && (
                      <div className="text-center space-y-6 py-4">
                        <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center mx-auto">
                          <QrCode className="w-10 h-10 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">Pague R$ {plans[selectedPlan].price} via PIX</p>
                          <p className="text-zinc-500 text-sm mt-1">Clique abaixo para gerar o QR Code. O acesso é liberado em segundos após o pagamento.</p>
                        </div>
                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-left">
                          <p className="text-amber-400 text-xs font-bold mb-1">⚠️ Atenção — PIX é cobrança única</p>
                          <p className="text-zinc-500 text-xs">O PIX ativa seu plano por 30 dias. Para renovação automática, use cartão de crédito.</p>
                        </div>
                        <button
                          onClick={handleGeneratePix}
                          disabled={isGeneratingPix}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95"
                        >
                          {isGeneratingPix ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />Gerando PIX...</>
                          ) : (
                            <><QrCode className="w-5 h-5" />Gerar QR Code</>
                          )}
                        </button>
                      </div>
                    )}

                    {/* QR Code gerado — aguardando pagamento */}
                    {pixStatus === 'pending' && pixQrBase64 && (
                      <div className="space-y-5">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                          <div className="w-52 h-52 bg-white p-3 rounded-3xl shadow-2xl shadow-white/5 shrink-0">
                            <img
                              src={`data:image/png;base64,${pixQrBase64}`}
                              alt="QR Code PIX"
                              className="w-full h-full rounded-xl"
                            />
                          </div>
                          <div className="flex-1 w-full space-y-4">
                            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                              <span className="text-sm">⏳</span>
                              <p className="text-amber-400 text-xs font-bold">Aguardando pagamento... Verificando a cada 5 segundos.</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">PIX Copia e Cola</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  readOnly
                                  value={pixQrCode || ''}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-[10px] font-mono text-zinc-400 pr-12 focus:outline-none truncate"
                                />
                                <button
                                  onClick={copyPixCode}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all"
                                >
                                  {pixCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={handleGeneratePix}
                              className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-all"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Gerar novo QR Code
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pagamento Aprovado */}
                    {pixStatus === 'approved' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-8 space-y-4"
                      >
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-emerald-400 font-black text-xl">Pagamento Confirmado!</p>
                          <p className="text-zinc-400 text-sm mt-1">Seu plano foi ativado. Redirecionando...</p>
                        </div>
                      </motion.div>
                    )}

                    {/* Erro no PIX */}
                    {pixStatus === 'error' && (
                      <div className="text-center py-6 space-y-4">
                        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
                        <p className="text-rose-400 font-bold">Erro ao gerar PIX. Tente novamente.</p>
                        <button
                          onClick={() => setPixStatus('idle')}
                          className="px-6 py-3 bg-zinc-800 text-white rounded-2xl font-black text-sm hover:bg-zinc-700 transition-all"
                        >
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
            {/* Cupom Card */}
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
                  {couponError && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 text-[10px] font-bold text-center">
                      {couponError}
                    </motion.p>
                  )}
                  {couponSuccess && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-500 text-[10px] font-bold text-center">
                      {couponSuccess}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Segurança */}
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
      )}
    </div>
  );
};
