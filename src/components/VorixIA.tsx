import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { User, Account, Transaction } from '../types';
import { db, doc, updateDoc, OperationType, handleStorageError } from '../lib/storage';
import { updateMissionProgress } from '../services/gamificationService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Bot, 
  Sparkles, 
  Loader2, 
  User as UserIcon,
  TrendingDown,
  PieChart as PieChartIcon,
  Zap,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface VorixIAProps {
  user: User;
  transactions: Transaction[];
  accounts: Account[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const VorixIA: React.FC<VorixIAProps & { fullView?: boolean }> = ({ user, transactions, accounts, fullView = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isEconomyMode, setIsEconomyMode] = useState(true);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Olá ${user.username}! Sou a IA Vorix, sua assistente financeira completa. Como posso ajudar sua evolução financeira hoje?` }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if ((isOpen || fullView) && messages.length === 1 && !loading) {
      handleSend('Faça uma análise rápida da minha saúde financeira atual e me dê um alerta ou dica proativa.');
    }
  }, [isOpen, fullView]);

  const handleSend = async (overrideInput?: string) => {
    const messageToSend = overrideInput || input;
    if (!messageToSend.trim() || loading) return;

    // Simple rate limiting: 1 message every 5 seconds
    const now = Date.now();
    if (now - lastMessageTime < 5000 && !overrideInput) {
      setError('Por favor, aguarde alguns segundos entre as mensagens para economizar recursos.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const userMessage = messageToSend.trim();
    
    // Daily Limit Check (8 requests/day)
    const today = new Date().toISOString().split('T')[0];
    const currentCount = user.lastAiRequestDate === today ? (user.aiRequestsCount || 0) : 0;
    
    if (currentCount >= 8 && !user.isPaid) {
      setError('Você atingiu o limite de 8 consultas diárias da IA Vorix. O limite reseta amanhã!');
      setTimeout(() => setError(null), 5000);
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);
    setLastMessageTime(now);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const model = ai.models.get({ model: 'gemini-3-flash-preview' });

      // ... existing data preparation ...
      const totalBalance: number = accounts.reduce((acc: number, curr: Account) => acc + curr.balance, 0);
      const monthlyIncome: number = transactions.filter(t => t.type === 'income').reduce((acc: number, curr: Transaction) => acc + curr.amount, 0);
      const monthlyExpenses: number = transactions.filter(t => t.type === 'expense').reduce((acc: number, curr: Transaction) => acc + curr.amount, 0);

      const categoryTotals = transactions.reduce((acc: Record<string, number>, t: Transaction) => {
        if (t.type === 'expense') {
          acc[t.category] = (acc[t.category] || 0) + t.amount;
        }
        return acc;
      }, {} as Record<string, number>);

      const sortedCategories = (Object.entries(categoryTotals) as [string, number][])
        .sort(([, a], [, b]) => b - a)
        .slice(0, isEconomyMode ? 5 : 15) // Limit categories in economy mode
        .map(([cat, total]) => `${cat}: ${formatCurrency(total)}`)
        .join(', ');

      const topCategory = Object.keys(categoryTotals)[0] || 'compras';
      const topCategoryTotal: number = categoryTotals[topCategory] || 0;
      const potentialSavings: number = topCategoryTotal * 0.15;
      const projectedBalance: number = totalBalance + monthlyIncome - monthlyExpenses;

      // Limit transactions history in economy mode
      const transactionContext = transactions
        .slice(0, isEconomyMode ? 10 : 30)
        .map(t => `${t.date} | ${t.description} (${t.category}): ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}`)
        .join('\n');

      const context = `
        Você é a IA Vorix. Sua missão é transformar a vida financeira do usuário.
        ${isEconomyMode ? 'Responda de forma extremamente concisa e direta para economizar tokens.' : 'Forneça análises profundas e detalhadas.'}

        DADOS (${user.username}):
        - Saldo: ${formatCurrency(totalBalance)}
        - Entradas/Saídas: ${formatCurrency(monthlyIncome)} / ${formatCurrency(monthlyExpenses)}
        - PONTOS: ${user.vorixScore}
        - Categorias: ${sortedCategories}
        - Transações: ${transactionContext}

        DIRETRIZES:
        1. Identifique economia em ${topCategory}.
        2. Projete saldo final: ${formatCurrency(projectedBalance)}.
        3. Use Markdown e emojis.
      `;

      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: context,
          maxOutputTokens: isEconomyMode ? 300 : 1000, // Direct token saving
        },
      });

      const response = await chat.sendMessage({ message: userMessage });
      
      // Update request count in Firestore
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          aiRequestsCount: currentCount + 1,
          lastAiRequestDate: today
        });
      } catch (err) {
        handleStorageError(err, OperationType.UPDATE, `users/${user.uid}`);
      }

      setMessages(prev => [...prev, { role: 'model', text: response.text || 'Desculpe, não consegui processar sua solicitação.' }]);
      
      // Update mission progress
      updateMissionProgress(user.uid, 'Curiosidade Vorix');
      updateMissionProgress(user.uid, 'IA Expert');
    } catch (error) {
      console.error('Gemini error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'Ocorreu um erro ao falar com a IA. Tente novamente mais tarde.' }]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text: string) => {
    // Simple formatter for bold and lists
    return text.split('\n').map((line, i) => {
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: formattedLine.substring(2) }} />;
      }
      return <p key={i} className="mb-2 last:mb-0" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
    });
  };

  if (fullView) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] lg:h-[calc(100vh-200px)] bg-zinc-900/40 border border-zinc-800/50 rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-3.5 lg:p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 lg:space-x-4">
            <div className="w-9 h-9 lg:w-12 lg:h-12 bg-orange-600 rounded-lg lg:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Bot className="text-white w-5 h-5 lg:w-7 lg:h-7" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm lg:text-lg">IA VORIX</h3>
              <div className="flex items-center space-x-1.5 lg:space-x-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-emerald-500 text-[9px] lg:text-xs uppercase font-bold tracking-widest">Online</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsEconomyMode(!isEconomyMode)}
              className={`flex items-center space-x-1.5 lg:space-x-2 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg lg:rounded-xl border transition-all ${isEconomyMode ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'}`}
            >
              <Zap className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${isEconomyMode ? 'fill-current' : ''}`} />
              <span className="text-[9px] lg:text-xs font-bold uppercase tracking-widest">{isEconomyMode ? 'Econômico' : 'Full'}</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-5 lg:space-y-6 custom-scrollbar bg-zinc-950/20"
        >
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-orange-600/10 border border-orange-500/50 p-2.5 lg:p-3 rounded-xl text-orange-500 text-[10px] lg:text-xs font-bold text-center"
            >
              {error}
            </motion.div>
          )}
          {messages.length === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 mb-6 lg:mb-8">
              {[
                { label: 'Analisar meus gastos', icon: TrendingDown, query: 'Pode analisar meus gastos recentes e me dizer onde posso economizar?' },
                { label: 'Dicas de investimento', icon: PieChartIcon, query: 'Com base no meu saldo, onde você recomenda que eu invista hoje?' },
                { label: 'Como aumentar meus pontos?', icon: Zap, query: 'O que eu preciso fazer para aumentar meus PONTOS Vorix?' },
                { label: 'Evasão de divisas', icon: AlertCircle, query: 'Você notou algum gasto desnecessário ou "vazamento" de dinheiro nas minhas contas?' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(action.query)}
                  className="flex items-center space-x-2.5 lg:space-x-3 p-3 lg:p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl lg:rounded-2xl hover:border-orange-500/50 hover:bg-zinc-800 transition-all text-left group"
                >
                  <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg group-hover:bg-orange-600/20 transition-all">
                    <action.icon className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                  </div>
                  <span className="text-xs lg:text-sm font-bold text-zinc-300 group-hover:text-white">{action.label}</span>
                </button>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-2.5 lg:space-x-4 max-w-[95%] lg:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-7 h-7 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-zinc-800 border border-zinc-700' : 'bg-orange-600 border border-orange-500/50'}`}>
                  {msg.role === 'user' ? <UserIcon className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-zinc-400" /> : <Bot className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-white" />}
                </div>
                <div className={`px-3.5 py-2.5 lg:p-5 rounded-xl lg:rounded-2xl text-xs lg:text-base leading-relaxed ${msg.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none shadow-lg shadow-orange-600/10' : 'bg-zinc-900/80 text-zinc-200 rounded-tl-none border border-zinc-800'}`}>
                  {formatMessage(msg.text)}
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-900/80 border border-zinc-800 p-3 lg:p-4 rounded-xl lg:rounded-2xl rounded-tl-none flex items-center space-x-2.5 lg:space-x-3">
                <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500 animate-spin" />
                <span className="text-[10px] lg:text-sm text-zinc-400 font-medium">Analisando dados...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 lg:p-6 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
          <div className="relative max-w-4xl mx-auto">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pergunte algo..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl lg:rounded-2xl pl-4 pr-12 py-3.5 lg:py-5 text-sm lg:text-lg text-zinc-200 focus:ring-2 focus:ring-orange-600/50 transition-all placeholder:text-zinc-600 shadow-inner"
            />
            <button 
              onClick={() => handleSend()}
              disabled={loading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 lg:p-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg lg:rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-600/20"
            >
              <Send className="w-4 h-4 lg:w-6 lg:h-6" />
            </button>
          </div>
          <p className="text-center text-zinc-600 text-[8px] lg:text-[9px] mt-2 lg:mt-3 uppercase tracking-[0.2em] font-bold">
            Vorix Intelligence System
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-[calc(100vw-32px)] sm:w-96 h-[450px] lg:h-[500px] bg-zinc-900 border border-zinc-800 rounded-2xl lg:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-3.5 lg:p-4 bg-orange-600 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 lg:space-x-3">
                <div className="w-7 h-7 lg:w-8 lg:h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bot className="text-white w-4 h-4 lg:w-5 lg:h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-xs lg:text-sm">Vorix IA</h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-white/70 text-[9px] lg:text-[10px] uppercase font-bold tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 lg:p-2 hover:bg-white/10 rounded-lg transition-all text-white"
              >
                <X className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3.5 lg:p-4 space-y-3.5 lg:space-y-4 custom-scrollbar bg-zinc-950/50"
            >
              {messages.length === 1 && (
                <div className="flex flex-wrap gap-1.5 lg:gap-2 mb-3 lg:mb-4">
                  {[
                    { label: 'Analisar Gastos', query: 'Pode analisar meus gastos recentes?' },
                    { label: 'Dicas Investimento', query: 'Onde posso investir hoje?' },
                  ].map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(action.query)}
                      className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 lg:px-3 lg:py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-orange-500/50 transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, x: msg.role === 'user' ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[92%] lg:max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-zinc-800' : 'bg-orange-600/20'}`}>
                      {msg.role === 'user' ? <UserIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-zinc-400" /> : <Bot className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-orange-500" />}
                    </div>
                    <div className={`px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl lg:rounded-2xl text-xs lg:text-sm leading-relaxed ${msg.role === 'user' ? 'bg-orange-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-300 rounded-tl-none'}`}>
                      {formatMessage(msg.text)}
                    </div>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 p-2.5 lg:p-3 rounded-xl lg:rounded-2xl rounded-tl-none flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-orange-500 animate-spin" />
                    <span className="text-[10px] lg:text-xs text-zinc-500">Vorix está pensando...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3.5 lg:p-4 border-t border-zinc-800 bg-zinc-900">
              <div className="relative">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Pergunte algo..."
                  className="w-full bg-zinc-800 border-none rounded-xl pl-4 pr-10 py-2.5 lg:py-3 text-xs lg:text-sm text-zinc-300 focus:ring-1 focus:ring-orange-600 transition-all"
                />
                <button 
                  onClick={handleSend}
                  disabled={loading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 lg:p-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${isOpen ? 'bg-zinc-800 text-white rotate-90' : 'bg-orange-600 text-white'}`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-zinc-950 rounded-full animate-pulse"></span>
        )}
      </motion.button>
    </div>
  );
};
