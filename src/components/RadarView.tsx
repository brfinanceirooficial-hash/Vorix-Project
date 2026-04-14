import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  RefreshCw,
  AlertCircle,
  Coins,
  DollarSign,
  BarChart3,
  Sparkles,
  Loader2,
  ExternalLink,
  Info,
  Star,
  Newspaper,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { updateMissionProgress } from '../services/gamificationService';
import { User } from '../types';

interface MarketData {
  usd:   { bid: string; pctChange: string; name: string };
  btc:   { bid: string; pctChange: string; name: string };
  stock: { bid: string; pctChange: string; name: string; symbol: string };
  updatedAt?: string;
}

interface InvestmentTip {
  title:       string;
  description: string;
  risk:        'low' | 'medium' | 'high';
  category:    string;
}

interface NewsItem {
  headline:  string;
  source:    string;
  url:       string;
  pubDate:   string;
  tag:       string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface RadarViewProps { user: User; }

// ─── Regras de visibilidade por plano ───────────────────────
const isPaid = (user: User) =>
  user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial';

export const RadarView: React.FC<RadarViewProps> = ({ user }) => {
  const [marketData,    setMarketData]    = useState<MarketData | null>(null);
  const [tips,          setTips]          = useState<InvestmentTip[]>([]);
  const [news,          setNews]          = useState<NewsItem[]>([]);
  const [loadingData,   setLoadingData]   = useState(true);
  const [loadingTips,   setLoadingTips]   = useState(true);
  const [loadingNews,   setLoadingNews]   = useState(true);
  const [dataError,     setDataError]     = useState<string | null>(null);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);

  // ── Dados de mercado ──────────────────────────────────────
  const fetchMarketData = async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const res  = await fetch('/api/radar-data');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setMarketData({ usd: data.usd, btc: data.btc, stock: data.stock, updatedAt: data.updatedAt });
      const ts = data.updatedAt ? new Date(data.updatedAt) : new Date();
      setLastUpdated(ts);
      localStorage.setItem('vorix_radar_market', JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {
      const cached = localStorage.getItem('vorix_radar_market');
      if (cached) {
        try {
          const c = JSON.parse(cached);
          setMarketData({ usd: c.usd, btc: c.btc, stock: c.stock });
          if (c.updatedAt) setLastUpdated(new Date(c.updatedAt));
        } catch {}
      } else {
        setDataError('Não foi possível carregar dados do mercado.');
      }
    } finally {
      setLoadingData(false);
    }
  };

  // ── Notícias reais do backend ─────────────────────────────
  const fetchNews = async () => {
    setLoadingNews(true);
    // Cache local diário
    const today   = new Date().toISOString().split('T')[0];
    const cacheKey = 'vorix_radar_news';
    const cached   = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (c.date === today && Array.isArray(c.news) && c.news.length >= 2) {
          setNews(c.news);
          setLoadingNews(false);
          return;
        }
      } catch {}
    }

    try {
      const res  = await fetch('/api/radar-news');
      const data = await res.json();
      if (data.success && data.news?.length) {
        setNews(data.news);
        localStorage.setItem(cacheKey, JSON.stringify({ date: today, news: data.news }));
      }
    } catch (err) {
      console.error('News fetch error:', err);
    } finally {
      setLoadingNews(false);
    }
  };

  // ── Dicas de investimento via Gemini ──────────────────────
  const fetchTips = async () => {
    setLoadingTips(true);
    const today   = new Date().toISOString().split('T')[0];
    const cacheKey = 'vorix_radar_tips';
    const cached   = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (c.date === today && c.tips?.length) {
          setTips(c.tips);
          setLoadingTips(false);
          return;
        }
      } catch {}
    }

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
      const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      const result = await ai.models.generateContent({
        model:    'gemini-3-flash-preview',
        contents: `Hoje é ${hoje}. Você é analista financeiro sênior do Brasil.
Gere 3 oportunidades de investimento práticas e atuais para o mercado brasileiro.
Foque em opções reais: Tesouro Direto, CDB, LCI/LCA, FIIs populares, ações blue chips (VALE3, ITUB4, WEGE3, PETR4).
Retorne JSON válido apenas, sem markdown, sem explicação:
[{"title":"Nome do ativo","description":"Descrição objetiva de até 120 chars","risk":"low"|"medium"|"high","category":"Renda Fixa"|"Ações"|"FII"|"Cripto"|"Internacional"}]`,
        config:   { responseMimeType: 'application/json' },
      });

      const tipsData: InvestmentTip[] = JSON.parse(result.text || '[]');
      setTips(tipsData);
      localStorage.setItem(cacheKey, JSON.stringify({ date: today, tips: tipsData }));
    } catch {
      setTips([
        { title: 'Tesouro Selic 2029',  description: 'Liquidez diária, sem risco de mercado. Ideal para reserva de emergência.', risk: 'low',    category: 'Renda Fixa' },
        { title: 'CDB 110% CDI',        description: 'Supera a poupança com garantia do FGC até R$ 250 mil.',                  risk: 'low',    category: 'Renda Fixa' },
        { title: 'IRDM11 (FII Papel)',  description: 'Dividendos mensais isentos de IR, indexados a CDI e IPCA.',              risk: 'medium', category: 'FII'        },
      ]);
    } finally {
      setLoadingTips(false);
    }
  };

  useEffect(() => {
    // Carrega cache instantâneo
    const cachedMarket = localStorage.getItem('vorix_radar_market');
    if (cachedMarket) {
      try {
        const c = JSON.parse(cachedMarket);
        if (Date.now() - (c.savedAt || 0) < 3_600_000) {
          setMarketData({ usd: c.usd, btc: c.btc, stock: c.stock });
          if (c.updatedAt) setLastUpdated(new Date(c.updatedAt));
          setLoadingData(false);
        }
      } catch {}
    }

    fetchMarketData();
    fetchNews();
    fetchTips();
    updateMissionProgress(user.uid, 'Explorador de Radar');
    updateMissionProgress(user.uid, 'Analista de Radar');
  }, []);

  const paidUser = isPaid(user);

  // ── Sub-componentes ──────────────────────────────────────
  const pct = (v: string) => parseFloat(v || '0');

  // Card de mercado com ou sem blur
  const MarketCard = ({
    icon: Icon, iconColor, bgColor, name, symbol, bid, pctChange,
    prefix = 'R$ ', suffix = '', delay = 0, locked = false,
  }: {
    icon: React.ElementType; iconColor: string; bgColor: string;
    name: string; symbol?: string; bid: string; pctChange: string;
    prefix?: string; suffix?: string; delay?: number; locked?: boolean;
  }) => {
    const p = pct(pctChange);
    const isUp = p >= 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className={`relative bg-zinc-900 border p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-3 overflow-hidden group transition-all ${
          locked ? 'border-zinc-800/60' : 'border-zinc-800 hover:border-zinc-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className={`p-2 lg:p-3 ${bgColor} rounded-lg lg:rounded-2xl`}>
            <Icon className={`w-4 h-4 lg:w-6 lg:h-6 ${iconColor}`} />
          </div>
          {!locked && (
            <div className={`flex items-center gap-0.5 text-[10px] lg:text-xs font-bold px-2 py-1 rounded-full ${
              isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(p).toFixed(2)}%
            </div>
          )}
          {locked && (
            <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/60 rounded-full text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
              <Lock className="w-2.5 h-2.5" />PRO
            </div>
          )}
        </div>

        <div className="space-y-0.5 lg:space-y-1">
          <p className="text-zinc-500 text-[8px] lg:text-xs font-bold uppercase tracking-widest">{symbol || name}</p>
          <p className={`text-lg lg:text-3xl font-black tracking-tighter text-white ${locked ? 'blur-md select-none' : ''}`}>
            {prefix}{bid}{suffix}
          </p>
          <p className="text-zinc-600 text-[8px] lg:text-[10px]">{name}</p>
        </div>

        {locked && (
          <div className="absolute inset-0 rounded-2xl lg:rounded-3xl bg-black/20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <Lock className="w-4 h-4 text-zinc-500" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ver no Pro</span>
            </div>
          </div>
        )}
        <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10 ${bgColor}`} />
      </motion.div>
    );
  };

  // Card de notícia
  const NewsCard = ({
    item, visible, delay = 0,
  }: { item: NewsItem; visible: boolean; delay?: number }) => {
    const sentimentColors = {
      positive: { bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'text-emerald-500', label: '▲ Alta' },
      negative: { bar: 'bg-rose-500',    badge: 'bg-rose-500/10    text-rose-400    border-rose-500/20',    icon: 'text-rose-500',    label: '▼ Baixa' },
      neutral:  { bar: 'bg-zinc-600',    badge: 'bg-zinc-800       text-zinc-400    border-zinc-700',       icon: 'text-zinc-500',    label: '● Neutro' },
    };
    const sc = sentimentColors[item.sentiment];

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl lg:rounded-3xl overflow-hidden hover:border-zinc-700 transition-all group"
      >
        {/* Barra lateral de sentimento */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${sc.bar}`} />

        <div className="pl-5 pr-5 pt-5 pb-4 lg:pl-6 lg:pr-6 lg:pt-6 lg:pb-5 space-y-3">
          {/* Badges */}
          <div className="flex items-center justify-between">
            <span className={`px-2.5 py-1 rounded-full text-[9px] lg:text-[10px] font-bold uppercase tracking-widest border ${sc.badge}`}>
              {item.tag}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] lg:text-[10px] font-bold ${sc.icon}`}>{sc.label}</span>
              <div className="flex items-center gap-1 text-zinc-600 text-[9px] font-medium">
                <Clock className="w-2.5 h-2.5" />
                <span>{item.pubDate}</span>
              </div>
            </div>
          </div>

          {/* Conteúdo com blur se locked */}
          <div className={`space-y-1.5 ${!visible ? 'blur-sm select-none' : ''}`}>
            <h4 className="text-sm lg:text-base font-black text-white leading-snug group-hover:text-orange-400 transition-colors">
              {item.headline}
            </h4>
            <p className="text-zinc-500 text-[10px] lg:text-xs font-medium">
              Fonte: {item.source}
            </p>
          </div>

          {/* Footer */}
          {visible ? (
            <a
              href={item.url || 'https://news.google.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] lg:text-xs font-bold text-zinc-500 hover:text-orange-400 transition-colors group/link w-fit"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Ler no Google News</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600">
              <Lock className="w-3 h-3" />
              <span>Disponível no Plano Pro</span>
            </div>
          )}
        </div>

        {/* Overlay de lock */}
        {!visible && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-4 py-3 rounded-2xl backdrop-blur-sm">
              <Star className="w-5 h-5 text-orange-500" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">Upgrade para ver</span>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-8 lg:space-y-12 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-4xl font-bold tracking-tight">Radar Vorix</h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-zinc-500 text-xs lg:text-base">Mercado em tempo real, notícias e oportunidades.</p>
            {lastUpdated && (
              <span className="text-[8px] lg:text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded-full border border-zinc-800">
                Atualizado {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => { fetchMarketData(); fetchNews(); fetchTips(); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-sm font-bold border border-zinc-800 active:scale-95 transition-all w-full md:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${(loadingData || loadingTips || loadingNews) ? 'animate-spin' : ''}`} />
          Atualizar Radar
        </button>
      </div>

      {/* ── Cards de Mercado ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base lg:text-xl font-bold text-white">Mercado Hoje</h3>
          {!paidUser && (
            <span className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-[10px] font-bold text-orange-400 uppercase tracking-widest">
              ⚡ Upgrade para ver tudo
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-5">
          {loadingData ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-32 lg:h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl lg:rounded-3xl animate-pulse" />
            ))
          ) : dataError && !marketData ? (
            <div className="col-span-full p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <p className="text-rose-400 text-sm font-bold">{dataError}</p>
            </div>
          ) : marketData ? (
            <>
              {/* USD — visível para todos */}
              <MarketCard icon={DollarSign} iconColor="text-blue-400" bgColor="bg-blue-500/10"
                name={marketData.usd.name} bid={marketData.usd.bid} pctChange={marketData.usd.pctChange} delay={0} locked={false} />

              {/* BTC — visível para todos */}
              <MarketCard icon={Coins} iconColor="text-orange-400" bgColor="bg-orange-500/10"
                name={marketData.btc.name} bid={marketData.btc.bid} pctChange={marketData.btc.pctChange} delay={0.05} locked={false} />

              {/* PETR4 — apenas Pro/Premium */}
              <MarketCard icon={TrendingUp} iconColor="text-emerald-400" bgColor="bg-emerald-500/10"
                name={marketData.stock.name} symbol={marketData.stock.symbol}
                bid={marketData.stock.bid} pctChange={marketData.stock.pctChange} delay={0.1} locked={!paidUser} />
            </>
          ) : null}
        </div>
      </div>

      {/* ── Notícias do Mercado ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-xl border border-zinc-700">
              <Newspaper className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-base lg:text-xl font-bold text-white">Notícias de Hoje</h3>
              <p className="text-zinc-600 text-[10px] font-medium">Atualiza diariamente com notícias reais</p>
            </div>
          </div>
          {loadingNews && <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {news.map((item, i) => (
              <NewsCard
                key={i}
                item={item}
                visible={paidUser || i === 0} // Trial vê só a 1ª
                delay={i * 0.06}
              />
            ))}
          </AnimatePresence>

          {loadingNews && !news.length && Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>

        {!paidUser && (
          <p className="text-[10px] text-zinc-600 text-center font-medium">
            💡 Plano Pro e Premium desbloqueiam todas as notícias e análises do Radar
          </p>
        )}
      </div>

      {/* ── Oportunidades IA ── */}
      <div className="space-y-4 lg:space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600/10 rounded-xl">
              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base lg:text-xl font-bold text-white">Oportunidades de Investimento</h3>
              <p className="text-zinc-600 text-[10px] font-medium">Análise IA — atualiza diariamente</p>
            </div>
          </div>
          {loadingTips && <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin text-zinc-500" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          {tips.map((tip, i) => {
            const riskConfig = {
              low:    { label: 'Baixo Risco',  cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
              medium: { label: 'Risco Médio',  cls: 'bg-amber-500/10   text-amber-500   border-amber-500/20'   },
              high:   { label: 'Alto Risco',   cls: 'bg-rose-500/10    text-rose-500    border-rose-500/20'    },
            }[tip.risk];

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative bg-zinc-900 border border-zinc-800 rounded-2xl lg:rounded-3xl p-5 lg:p-7 space-y-4 overflow-hidden group hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    {tip.category}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${riskConfig.cls}`}>
                    {riskConfig.label}
                  </span>
                </div>

                <div className={`space-y-1.5 ${!paidUser ? 'blur-sm select-none' : ''}`}>
                  <h4 className="text-base lg:text-lg font-black text-white group-hover:text-orange-400 transition-colors">
                    {tip.title}
                  </h4>
                  <p className="text-zinc-500 text-xs leading-relaxed">{tip.description}</p>
                </div>

                {!paidUser && (
                  <div className="absolute inset-0 rounded-2xl lg:rounded-3xl bg-black/40 flex flex-col items-center justify-center gap-1.5">
                    <Star className="w-6 h-6 text-orange-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Ver no Plano Pro</span>
                  </div>
                )}

                {paidUser && (
                  <a
                    href="https://www.infomoney.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-orange-400 transition-colors font-bold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Saiba mais
                  </a>
                )}
              </motion.div>
            );
          })}

          {loadingTips && !tips.length && Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>

      {/* ── Aviso Legal ── */}
      <div className="p-4 lg:p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-start gap-3 lg:gap-4">
        <div className="p-1.5 bg-blue-500/10 rounded-lg mt-0.5">
          <Info className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
        </div>
        <div className="space-y-1">
          <p className="text-xs lg:text-sm font-bold text-zinc-300">Aviso Legal</p>
          <p className="text-[9px] lg:text-xs text-zinc-500 leading-relaxed">
            As notícias são obtidas de fontes públicas de mercado. As oportunidades são geradas por IA e não constituem recomendações oficiais de investimento.
            O mercado financeiro envolve riscos. Consulte sempre um profissional certificado antes de investir.
          </p>
        </div>
      </div>
    </div>
  );
};
