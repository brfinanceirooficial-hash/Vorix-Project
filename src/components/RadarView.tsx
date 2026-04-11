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
  Info
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { formatCurrency } from '../lib/utils';
import { updateMissionProgress } from '../services/gamificationService';
import { User } from '../types';

interface MarketData {
  usd: { bid: string; pctChange: string; name: string };
  btc: { bid: string; pctChange: string; name: string };
  ibov: { bid: string; pctChange: string; name: string; symbol: string };
  stock: { bid: string; pctChange: string; name: string; symbol: string };
}

interface InvestmentTip {
  title: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  category: string;
}

interface RadarViewProps {
  user: User;
}

export const RadarView: React.FC<RadarViewProps> = ({ user }) => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [tips, setTips] = useState<InvestmentTip[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingTips, setIsLoadingTips] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarketData = async () => {
    // Only show loading if we don't have cached data
    if (!localStorage.getItem('vorix_radar_market_data')) {
      setIsLoadingData(true);
    }
    setError(null);
    try {
      // 1. Fetching USD and BTC from AwesomeAPI with cache busting
      const timestamp = Date.now();
      const awesomeResponse = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL,BTC-BRL?t=${timestamp}`);
      const awesomeData = await awesomeResponse.json();

      // 2. Fetching IBOVESPA and PETR4 from Yahoo Finance via AllOrigins proxy
      const fetchStock = async (ticker: string) => {
        try {
          const url = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`);
          const res = await fetch(`https://api.allorigins.win/get?url=${url}`);
          if (!res.ok) throw new Error('Proxy error');
          const wrapper = await res.json();
          const data = JSON.parse(wrapper.contents);
          const meta = data.chart.result[0].meta;
          return {
            price: meta.regularMarketPrice,
            prevClose: meta.previousClose
          };
        } catch (e) {
          console.warn(`Failed to fetch ${ticker}:`, e);
          return null;
        }
      };

      const [ibovRes, petrRes] = await Promise.all([
        fetchStock('^BVSP'),
        fetchStock('PETR4.SA')
      ]);

      const newData: MarketData = {
        usd: {
          bid: awesomeData.USDBRL?.bid || '0.00',
          pctChange: awesomeData.USDBRL?.pctChange || '0.00',
          name: 'Dólar Comercial'
        },
        btc: {
          bid: awesomeData.BTCBRL?.bid || '0.00',
          pctChange: awesomeData.BTCBRL?.pctChange || '0.00',
          name: 'Bitcoin'
        },
        ibov: {
          bid: ibovRes?.price ? ibovRes.price.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0',
          pctChange: ibovRes?.price && ibovRes?.prevClose ? (((ibovRes.price - ibovRes.prevClose) / ibovRes.prevClose) * 100).toFixed(2) : '0.00',
          name: 'Ibovespa',
          symbol: 'IBOV'
        },
        stock: {
          bid: petrRes?.price ? petrRes.price.toFixed(2) : '0.00',
          pctChange: petrRes?.price && petrRes?.prevClose ? (((petrRes.price - petrRes.prevClose) / petrRes.prevClose) * 100).toFixed(2) : '0.00',
          name: 'Petrobras PN',
          symbol: 'PETR4'
        }
      };

      setMarketData(newData);
      const now = new Date();
      setLastUpdated(now);
      
      // Update cache
      localStorage.setItem('vorix_radar_market_data', JSON.stringify(newData));
      localStorage.setItem('vorix_radar_last_updated', now.toISOString());
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Falha ao carregar dados do mercado. Verifique sua conexão.');
      
      // Fallback to AwesomeAPI only if Yahoo fails
      try {
        const timestamp = Date.now();
        const awesomeResponse = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-BRL,BTC-BRL?t=${timestamp}`);
        const awesomeData = await awesomeResponse.json();
        const fallbackData: MarketData = {
          usd: { 
            bid: awesomeData.USDBRL?.bid || '0.00', 
            pctChange: awesomeData.USDBRL?.pctChange || '0.00', 
            name: 'Dólar Comercial' 
          },
          btc: { 
            bid: awesomeData.BTCBRL?.bid || '0.00', 
            pctChange: awesomeData.BTCBRL?.pctChange || '0.00', 
            name: 'Bitcoin' 
          },
          ibov: marketData?.ibov || { bid: '126.000', pctChange: '0.00', name: 'Ibovespa', symbol: 'IBOV' },
          stock: marketData?.stock || { bid: '38.42', pctChange: '0.00', name: 'Petrobras PN', symbol: 'PETR4' }
        };
        setMarketData(fallbackData);
      } catch (e) {
        setError('Erro crítico ao buscar dados financeiros.');
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  const generateTips = async () => {
    // Only show loading if we don't have cached tips
    if (!localStorage.getItem('vorix_radar_tips')) {
      setIsLoadingTips(true);
    }
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
      
      const prompt = `
        Gere 3 dicas de investimentos reais e atuais para o mercado brasileiro hoje. 
        As dicas devem ser de fácil acesso (ex: Tesouro Direto, CDBs, Fundos Imobiliários populares ou Ações consolidadas).
        
        IMPORTANTE: 
        - As dicas devem ser baseadas em tendências reais de mercado (março de 2026).
        - Deixe claro que são apenas sugestões e não garantia de lucro.
        
        Retorne no formato JSON:
        Array<{
          title: string,
          description: string,
          risk: "low" | "medium" | "high",
          category: string
        }>
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                risk: { type: Type.STRING, enum: ["low", "medium", "high"] },
                category: { type: Type.STRING }
              },
              required: ["title", "description", "risk", "category"]
            }
          }
        }
      });

      const generatedTips = JSON.parse(result.text);
      setTips(generatedTips);
      
      // Update cache
      localStorage.setItem('vorix_radar_tips', JSON.stringify(generatedTips));
    } catch (err) {
      console.error('Error generating tips:', err);
      // Fallback tips if AI fails
      const fallbackTips: InvestmentTip[] = [
        { title: 'Tesouro Selic 2029', description: 'Ideal para reserva de emergência com liquidez diária e baixo risco.', risk: 'low', category: 'Renda Fixa' },
        { title: 'CDB 110% do CDI', description: 'Ótima opção para superar a inflação com garantia do FGC.', risk: 'low', category: 'Renda Fixa' },
        { title: 'FIIs de Papel', description: 'Dividendos mensais isentos de IR, mas com volatilidade de mercado.', risk: 'medium', category: 'Variável' }
      ];
      setTips(fallbackTips);
    } finally {
      setIsLoadingTips(false);
    }
  };

  useEffect(() => {
    // Load from cache first for instant feel
    const cachedData = localStorage.getItem('vorix_radar_market_data');
    const cachedTips = localStorage.getItem('vorix_radar_tips');
    const cachedTime = localStorage.getItem('vorix_radar_last_updated');

    if (cachedData) {
      try {
        setMarketData(JSON.parse(cachedData));
        setIsLoadingData(false);
      } catch (e) {
        console.error('Error parsing cached market data');
      }
    }

    if (cachedTips) {
      try {
        setTips(JSON.parse(cachedTips));
        setIsLoadingTips(false);
      } catch (e) {
        console.error('Error parsing cached tips');
      }
    }

    if (cachedTime) {
      setLastUpdated(new Date(cachedTime));
    }

    // Fetch fresh data in background
    fetchMarketData();
    generateTips();
    
    // Track mission progress
    updateMissionProgress(user.uid, 'Explorador de Radar');
    updateMissionProgress(user.uid, 'Analista de Radar');
  }, []);

  return (
    <div className="space-y-6 lg:space-y-10">
      {/* Market Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-4xl font-bold tracking-tight">Radar Vorix</h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-zinc-500 text-xs lg:text-lg">Monitoramento em tempo real do mercado e oportunidades.</p>
            {lastUpdated && (
              <span className="text-[8px] lg:text-[10px] font-bold text-zinc-600 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded-full">
                Atualizado: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <button 
          onClick={() => { fetchMarketData(); generateTips(); }}
          className="flex items-center justify-center space-x-2 px-5 py-2.5 lg:px-6 lg:py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl lg:rounded-2xl text-xs lg:text-base font-bold transition-all border border-zinc-800 active:scale-95 w-full md:w-auto"
        >
          <RefreshCw className={`w-4 h-4 lg:w-5 lg:h-5 ${(isLoadingData || isLoadingTips) ? 'animate-spin' : ''}`} />
          <span>Atualizar Radar</span>
        </button>
      </div>

      {/* Market Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {isLoadingData ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-32 lg:h-40 bg-zinc-900/50 border border-zinc-800 rounded-2xl lg:rounded-3xl animate-pulse" />
          ))
        ) : marketData ? (
          <>
            {/* USD */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-4 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 lg:p-3 bg-blue-500/10 rounded-lg lg:rounded-2xl border border-blue-500/20">
                  <DollarSign className="w-4 h-4 lg:w-6 lg:h-6 text-blue-500" />
                </div>
                <div className={`flex items-center space-x-1 text-[10px] lg:text-xs font-bold ${parseFloat(marketData.usd?.pctChange || '0') >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {parseFloat(marketData.usd?.pctChange || '0') >= 0 ? <TrendingUp className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> : <TrendingDown className="w-2.5 h-2.5 lg:w-3 lg:h-3" />}
                  <span>{marketData.usd?.pctChange || '0.00'}%</span>
                </div>
              </div>
              <div className="space-y-0.5 lg:space-y-1">
                <p className="text-zinc-500 text-[8px] lg:text-xs font-bold uppercase tracking-widest truncate">{marketData.usd?.name || 'Dólar'}</p>
                <div className="relative">
                  <p className={`text-lg lg:text-3xl font-bold tracking-tighter ${(user.plan === 'trial' || !user.plan) ? 'blur-md select-none' : ''}`}>
                    R$ {parseFloat(marketData.usd?.bid || '0').toFixed(2)}
                  </p>
                  {(user.plan === 'trial' || !user.plan) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-orange-500 opacity-50" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* BTC */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-4 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 lg:p-3 bg-orange-500/10 rounded-lg lg:rounded-2xl border border-orange-500/20">
                  <Coins className="w-4 h-4 lg:w-6 lg:h-6 text-orange-500" />
                </div>
                <div className={`flex items-center space-x-1 text-[10px] lg:text-xs font-bold ${parseFloat(marketData.btc?.pctChange || '0') >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {parseFloat(marketData.btc?.pctChange || '0') >= 0 ? <TrendingUp className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> : <TrendingDown className="w-2.5 h-2.5 lg:w-3 lg:h-3" />}
                  <span>{marketData.btc?.pctChange || '0.00'}%</span>
                </div>
              </div>
              <div className="space-y-0.5 lg:space-y-1">
                <p className="text-zinc-500 text-[8px] lg:text-xs font-bold uppercase tracking-widest truncate">{marketData.btc?.name || 'Bitcoin'}</p>
                <div className="relative">
                  <p className={`text-lg lg:text-3xl font-bold tracking-tighter ${(user.plan === 'trial' || !user.plan) ? 'blur-md select-none' : ''}`}>
                    R$ {parseFloat(marketData.btc?.bid || '0').toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                  </p>
                  {(user.plan === 'trial' || !user.plan) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-orange-500 opacity-50" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* IBOV */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-4 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 lg:p-3 bg-purple-500/10 rounded-lg lg:rounded-2xl border border-purple-500/20">
                  <BarChart3 className="w-4 h-4 lg:w-6 lg:h-6 text-purple-500" />
                </div>
                <div className={`flex items-center space-x-1 text-[10px] lg:text-xs font-bold ${parseFloat(marketData.ibov?.pctChange || '0') >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {parseFloat(marketData.ibov?.pctChange || '0') >= 0 ? <TrendingUp className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> : <TrendingDown className="w-2.5 h-2.5 lg:w-3 lg:h-3" />}
                  <span>{marketData.ibov?.pctChange || '0.00'}%</span>
                </div>
              </div>
              <div className="space-y-0.5 lg:space-y-1">
                <p className="text-zinc-500 text-[8px] lg:text-xs font-bold uppercase tracking-widest truncate">{marketData.ibov?.name || 'Ibovespa'}</p>
                <div className="relative">
                  <p className={`text-lg lg:text-3xl font-bold tracking-tighter ${(user.plan === 'trial' || !user.plan) ? 'blur-md select-none' : ''}`}>
                    {marketData.ibov?.bid || '0'} pts
                  </p>
                  {(user.plan === 'trial' || !user.plan) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-500 opacity-50" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Stock (PETR4) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-4 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 lg:p-3 bg-emerald-500/10 rounded-lg lg:rounded-2xl border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4 lg:w-6 lg:h-6 text-emerald-500" />
                </div>
                <div className={`flex items-center space-x-1 text-[10px] lg:text-xs font-bold ${parseFloat(marketData.stock?.pctChange || '0') >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {parseFloat(marketData.stock?.pctChange || '0') >= 0 ? <TrendingUp className="w-2.5 h-2.5 lg:w-3 lg:h-3" /> : <TrendingDown className="w-2.5 h-2.5 lg:w-3 lg:h-3" />}
                  <span>{marketData.stock?.pctChange || '0.00'}%</span>
                </div>
              </div>
              <div className="space-y-0.5 lg:space-y-1">
                <p className="text-zinc-500 text-[8px] lg:text-xs font-bold uppercase tracking-widest truncate">{marketData.stock?.symbol || 'PETR4'}</p>
                <div className="relative">
                  <p className={`text-lg lg:text-3xl font-bold tracking-tighter ${(user.plan === 'trial' || !user.plan) ? 'blur-md select-none' : ''}`}>
                    R$ {marketData.stock?.bid || '0.00'}
                  </p>
                  {(user.plan === 'trial' || !user.plan) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-emerald-500 opacity-50" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="col-span-full p-6 lg:p-8 bg-rose-500/10 border border-rose-500/20 rounded-2xl lg:rounded-3xl text-center">
            <AlertCircle className="w-6 h-6 lg:w-8 lg:h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-rose-500 text-xs lg:text-base font-bold">{error}</p>
          </div>
        )}
      </div>

      {/* Investment Tips */}
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg lg:rounded-xl">
              <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
            </div>
            <h3 className="text-lg lg:text-2xl font-bold">Dicas de Investimento</h3>
          </div>
          {isLoadingTips && <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin text-zinc-500" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
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
                    tip.risk === 'low' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    tip.risk === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  }`}>
                    Risco {tip.risk === 'low' ? 'Baixo' : tip.risk === 'medium' ? 'Médio' : 'Alto'}
                  </span>
                </div>
                <div className="space-y-1 lg:space-y-2 relative">
                  <h4 className={`text-base lg:text-xl font-bold group-hover:text-orange-500 transition-colors ${(user.plan === 'trial' || !user.plan) ? 'blur-[4px] select-none' : ''}`}>
                    {tip.title}
                  </h4>
                  <p className={`text-zinc-500 text-xs lg:text-base leading-relaxed ${(user.plan === 'trial' || !user.plan) ? 'blur-md select-none' : ''}`}>
                    {tip.description}
                  </p>
                  {(user.plan === 'trial' || !user.plan) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-xl">
                      <Star className="w-6 h-6 text-orange-500 mb-1" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Upgrade para ver</span>
                    </div>
                  )}
                </div>
                <div className="pt-2 lg:pt-4 flex items-center justify-between">
                  <a 
                    href="https://www.instagram.com/br.financeiro/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] lg:text-xs font-bold text-zinc-400 hover:text-white flex items-center space-x-1 transition-colors"
                  >
                    <span>Saiba mais</span>
                    <ExternalLink className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                  </a>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Disclaimer */}
        <div className="p-4 lg:p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl lg:rounded-3xl flex items-start space-x-3 lg:space-x-4">
          <div className="p-1.5 lg:p-2 bg-blue-500/10 rounded-lg lg:rounded-xl mt-0.5 lg:mt-1">
            <Info className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
          </div>
          <div className="space-y-0.5 lg:space-y-1">
            <p className="text-xs lg:text-sm font-bold text-zinc-300">Aviso Legal</p>
            <p className="text-[9px] lg:text-xs text-zinc-500 leading-relaxed">
              As informações e dicas apresentadas no Radar Vorix são baseadas em dados de mercado e análises da nossa inteligência artificial. 
              Elas não constituem recomendações oficiais de investimento ou garantia de lucro. O mercado financeiro envolve riscos e o desempenho passado não garante resultados futuros. 
              Sempre consulte um profissional certificado antes de tomar decisões financeiras importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
