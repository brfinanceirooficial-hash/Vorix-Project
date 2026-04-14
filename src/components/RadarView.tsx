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
  TrendingUp as TrendingUpIcon,
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { updateMissionProgress } from '../services/gamificationService';
import { User } from '../types';

interface MarketData {
  usd: { bid: string; pctChange: string; name: string };
  btc: { bid: string; pctChange: string; name: string };
  ibov: { bid: string; pctChange: string; name: string; symbol: string };
  stock: { bid: string; pctChange: string; name: string; symbol: string };
  updatedAt?: string;
}

interface InvestmentTip {
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  category: string;
}

interface NewsItem {
  headline: string;
  summary: string;
  tag: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface RadarViewProps {
  user: User;
}

const isPlanFree = (user: User) => !user.plan || user.plan === 'trial';

export const RadarView: React.FC<RadarViewProps> = ({ user }) => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tips, setTips] = useState<InvestmentTip[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingTips, setIsLoadingTips] = useState(true);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarketData = async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const res = await fetch('/api/radar-data');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erro ao buscar dados');

      setMarketData({
        usd:   data.usd,
        btc:   data.btc,
        ibov:  data.ibov,
        stock: data.stock,
        updatedAt: data.updatedAt,
      });

      const updated = data.updatedAt ? new Date(data.updatedAt) : new Date();
      setLastUpdated(updated);
      localStorage.setItem('vorix_radar_market', JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch (err: any) {
      console.error('Radar market error:', err);
      // tenta cache
      const cached = localStorage.getItem('vorix_radar_market');
      if (cached) {
        try {
          const c = JSON.parse(cached);
          setMarketData({ usd: c.usd, btc: c.btc, ibov: c.ibov, stock: c.stock });
          if (c.updatedAt) setLastUpdated(new Date(c.updatedAt));
        } catch {}
      } else {
        setDataError('Não foi possível carregar dados do mercado. Verifique sua conexão.');
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  const generateAIContent = async () => {
    const cachedContent = localStorage.getItem('vorix_radar_ai');
    const today = new Date().toISOString().split('T')[0];
    if (cachedContent) {
      try {
        const c = JSON.parse(cachedContent);
        if (c.date === today) {
          setTips(c.tips || []);
          setNews(c.news || []);
          setIsLoadingTips(false);
          setIsLoadingNews(false);
          return;
        }
      } catch {}
    }

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

      const prompt = `Você é um analista financeiro sênior do mercado brasileiro. Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Gere um JSON com DOIS campos:

1. "tips": Array com 3 dicas de investimentos práticas e atuais para o mercado brasileiro. Exemplos: Tesouro Direto, CDB, FIIs, ações blue chips (ex: VALE3, ITUB4, WEGE3).

2. "news": Array com 2 notícias recentes de mercado financeiro brasileiro (REAL - pode mencionar movimentos de juros SELIC, IBOVESPA, câmbio, resultado de empresas, IPOs, tendências).

Formato exato:
{
  "tips": [
    {
      "title": "Nome do investimento",
      "description": "Descrição clara de até 120 caracteres",
      "risk": "low" | "medium" | "high",
      "category": "Renda Fixa" | "Ações" | "FII" | "Cripto" | "Internacional"
    }
  ],
  "news": [
    {
      "headline": "Título da notícia em até 80 caracteres",
      "summary": "Resumo de até 140 caracteres explicando o impacto para investidores",
      "tag": "Bolsa" | "Câmbio" | "Juros" | "Cripto" | "Macro",
      "sentiment": "positive" | "negative" | "neutral"
    }
  ]
}`;

      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(result.text || '{}');
      const tipsData: InvestmentTip[] = parsed.tips || [];
      const newsData: NewsItem[] = parsed.news || [];

      setTips(tipsData);
      setNews(newsData);
      localStorage.setItem('vorix_radar_ai', JSON.stringify({ date: today, tips: tipsData, news: newsData }));
    } catch (err) {
      console.error('AI content error:', err);
      setTips([
        { title: 'Tesouro Selic 2029', description: 'Ideal para reserva de emergência com liquidez diária e baixo risco.', risk: 'low', category: 'Renda Fixa' },
        { title: 'CDB 110% CDI', description: 'Retorno superior à poupança com garantia do FGC até R$ 250 mil.', risk: 'low', category: 'Renda Fixa' },
        { title: 'FIIs de Papel (IRDM11)', description: 'Dividendos mensais isentos de IR, expostos a IPCA e CDI.', risk: 'medium', category: 'FII' },
      ]);
      setNews([
        { headline: 'Ibovespa opera próximo dos 130 mil pontos', summary: 'Bolsa brasileira sustenta recuperação impulsionada por ações de commodities.', tag: 'Bolsa', sentiment: 'positive' },
        { headline: 'BC mantém SELIC em 14,75% ao ano', summary: 'Copom sinalizou pausa no ciclo de alta. Mercado ajusta projeções para o fim do ano.', tag: 'Juros', sentiment: 'neutral' },
      ]);
    } finally {
      setIsLoadingTips(false);
      setIsLoadingNews(false);
    }
  };

  useEffect(() => {
    // Cache instantâneo
    const cachedMarket = localStorage.getItem('vorix_radar_market');
    if (cachedMarket) {
      try {
        const c = JSON.parse(cachedMarket);
        const age = Date.now() - (c.savedAt || 0);
        if (age < 60 * 60 * 1000) { // menos de 1h
          setMarketData({ usd: c.usd, btc: c.btc, ibov: c.ibov, stock: c.stock });
          if (c.updatedAt) setLastUpdated(new Date(c.updatedAt));
          setIsLoadingData(false);
        }
      } catch {}
    }

    fetchMarketData();
    generateAIContent();
    updateMissionProgress(user.uid, 'Explorador de Radar');
    updateMissionProgress(user.uid, 'Analista de Radar');
  }, []);

  const isFree = isPlanFree(user);

  const MarketCard = ({
    icon: Icon,
    iconColor,
    bgColor,
    name,
    symbol,
    bid,
    pctChange,
    prefix = 'R$ ',
    suffix = '',
    delay = 0,
  }: {
    icon: React.ElementType; iconColor: string; bgColor: string;
    name: string; symbol?: string; bid: string; pctChange: string;
    prefix?: string; suffix?: string; delay?: number;
  }) => {
    const pct = parseFloat(pctChange || '0');
    const isPositive = pct >= 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-4 relative overflow-hidden group hover:border-zinc-700 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className={`p-2 lg:p-3 ${bgColor} rounded-lg lg:rounded-2xl`}>
            <Icon className={`w-4 h-4 lg:w-6 lg:h-6 ${iconColor}`} />
          </div>
          <div className={`flex items-center space-x-1 text-[10px] lg:text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            <span>{Math.abs(pct).toFixed(2)}%</span>
          </div>
        </div>
        <div className="space-y-0.5 lg:space-y-1">
          <p className="text-zinc-500 text-[8px] lg:text-xs font-bold uppercase tracking-widest">{symbol || name}</p>
          <div className="relative">
            <p className={`text-lg lg:text-3xl font-black tracking-tighter ${isFree ? 'blur-md select-none' : ''}`}>
              {prefix}{bid}{suffix}
            </p>
            {isFree && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className={`w-5 h-5 ${iconColor} opacity-60`} />
              </div>
            )}
          </div>
          <p className="text-zinc-600 text-[8px] lg:text-[10px] font-medium">{name}</p>
        </div>
        <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-10 ${bgColor}`} />
      </motion.div>
    );
  };

  return (
    <div className="space-y-6 lg:space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-4xl font-bold tracking-tight">Radar Vorix</h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-zinc-500 text-xs lg:text-lg">Mercado, oportunidades e notícias financeiras.</p>
            {lastUpdated && (
              <span className="text-[8px] lg:text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded-full border border-zinc-800">
                Atualizado: {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => { fetchMarketData(); generateAIContent(); }}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 lg:px-6 lg:py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all border border-zinc-800 active:scale-95 w-full md:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoadingData || isLoadingTips) ? 'animate-spin' : ''}`} />
          <span>Atualizar Radar</span>
        </button>
      </div>

      {/* Market Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {isLoadingData ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-32 lg:h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl lg:rounded-3xl animate-pulse" />
          ))
        ) : dataError && !marketData ? (
          <div className="col-span-full p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-rose-400 text-sm font-bold">{dataError}</p>
          </div>
        ) : marketData ? (
          <>
            <MarketCard
              icon={DollarSign} iconColor="text-blue-400" bgColor="bg-blue-500/10"
              name={marketData.usd.name} bid={marketData.usd.bid}
              pctChange={marketData.usd.pctChange} delay={0}
            />
            <MarketCard
              icon={Coins} iconColor="text-orange-400" bgColor="bg-orange-500/10"
              name={marketData.btc.name} bid={marketData.btc.bid}
              pctChange={marketData.btc.pctChange} delay={0.05}
            />
            <MarketCard
              icon={BarChart3} iconColor="text-purple-400" bgColor="bg-purple-500/10"
              name={marketData.ibov.name} symbol={marketData.ibov.symbol}
              bid={marketData.ibov.bid} pctChange={marketData.ibov.pctChange}
              prefix="" suffix=" pts" delay={0.1}
            />
            <MarketCard
              icon={TrendingUpIcon} iconColor="text-emerald-400" bgColor="bg-emerald-500/10"
              name={marketData.stock.name} symbol={marketData.stock.symbol}
              bid={marketData.stock.bid} pctChange={marketData.stock.pctChange} delay={0.15}
            />
          </>
        ) : null}
      </div>

      {/* Aviso plano free */}
      {isFree && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl"
        >
          <Zap className="w-5 h-5 text-orange-500 shrink-0" />
          <div>
            <p className="text-orange-400 text-sm font-black">Valores com Spoiler ativo</p>
            <p className="text-zinc-500 text-xs">Faça upgrade para ver dólar, BTC, IBOV e PETR4 em tempo real.</p>
          </div>
        </motion.div>
      )}

      {/* Notícias do Mercado */}
      <div className="space-y-4 lg:space-y-5">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 lg:p-2 bg-zinc-800 rounded-lg lg:rounded-xl border border-zinc-700">
            <Newspaper className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-300" />
          </div>
          <h3 className="text-lg lg:text-2xl font-bold">Notícias do Mercado</h3>
          {isLoadingNews && <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          <AnimatePresence mode="popLayout">
            {news.map((item, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`relative p-5 lg:p-7 rounded-2xl lg:rounded-3xl border space-y-3 overflow-hidden ${
                  isFree ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-all'
                }`}
              >
                {/* Linha lateral colorida */}
                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${
                  item.sentiment === 'positive' ? 'bg-emerald-500' :
                  item.sentiment === 'negative' ? 'bg-rose-500' : 'bg-zinc-600'
                }`} />

                <div className="flex items-center justify-between pl-3">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] lg:text-[11px] font-bold uppercase tracking-widest border ${
                    item.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    item.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {item.tag}
                  </span>
                  <span className={`text-[9px] lg:text-[10px] font-bold uppercase tracking-widest ${
                    item.sentiment === 'positive' ? 'text-emerald-500' :
                    item.sentiment === 'negative' ? 'text-rose-500' : 'text-zinc-500'
                  }`}>
                    {item.sentiment === 'positive' ? '▲ Alta' : item.sentiment === 'negative' ? '▼ Baixa' : '● Neutro'}
                  </span>
                </div>

                <div className={`pl-3 space-y-1.5 ${isFree ? 'blur-sm select-none' : ''}`}>
                  <h4 className="text-sm lg:text-base font-black text-white leading-snug">{item.headline}</h4>
                  <p className="text-zinc-500 text-xs lg:text-sm leading-relaxed">{item.summary}</p>
                </div>

                {isFree && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                    <Star className="w-5 h-5 text-orange-500 mb-1" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Upgrade para ver</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoadingNews && Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-28 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>

      {/* Dicas de Investimento */}
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg lg:rounded-xl">
              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
            </div>
            <h3 className="text-lg lg:text-2xl font-bold">Oportunidades IA</h3>
          </div>
          {isLoadingTips && <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin text-zinc-500" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <AnimatePresence mode="popLayout">
            {tips.map((tip, i) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={i}
                className="bg-zinc-900 border border-zinc-800 p-5 lg:p-8 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-4 hover:border-zinc-700 transition-all group relative"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 lg:px-3 lg:py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[8px] lg:text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {tip.category}
                  </span>
                  <span className={`px-2 py-0.5 lg:px-3 lg:py-1 rounded-full text-[8px] lg:text-[10px] font-bold uppercase tracking-widest border ${
                    tip.risk === 'low'    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    tip.risk === 'medium' ? 'bg-amber-500/10   text-amber-500   border-amber-500/20'   :
                                           'bg-rose-500/10    text-rose-500    border-rose-500/20'
                  }`}>
                    {tip.risk === 'low' ? 'Baixo' : tip.risk === 'medium' ? 'Médio' : 'Alto'}
                  </span>
                </div>

                <div className="space-y-1 lg:space-y-2 relative">
                  <h4 className={`text-base lg:text-xl font-bold group-hover:text-orange-500 transition-colors ${isFree ? 'blur-[4px] select-none' : ''}`}>
                    {tip.title}
                  </h4>
                  <p className={`text-zinc-500 text-xs lg:text-sm leading-relaxed ${isFree ? 'blur-md select-none' : ''}`}>
                    {tip.description}
                  </p>
                  {isFree && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-xl">
                      <Star className="w-6 h-6 text-orange-500 mb-1" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Upgrade para ver</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <a
                    href="https://www.instagram.com/br.financeiro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] lg:text-xs font-bold text-zinc-400 hover:text-orange-500 flex items-center space-x-1 transition-colors"
                  >
                    <span>Saiba mais</span>
                    <ExternalLink className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoadingTips && Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="p-4 lg:p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl lg:rounded-3xl flex items-start space-x-3 lg:space-x-4">
        <div className="p-1.5 lg:p-2 bg-blue-500/10 rounded-lg lg:rounded-xl mt-0.5">
          <Info className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
        </div>
        <div className="space-y-0.5 lg:space-y-1">
          <p className="text-xs lg:text-sm font-bold text-zinc-300">Aviso Legal</p>
          <p className="text-[9px] lg:text-xs text-zinc-500 leading-relaxed">
            As informações do Radar Vorix são geradas por inteligência artificial e dados de mercado públicos.
            Não constituem recomendações oficiais de investimento ou garantia de lucro. Sempre consulte um profissional certificado antes de tomar decisões financeiras.
          </p>
        </div>
      </div>
    </div>
  );
};
