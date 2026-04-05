import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { db, collection, addDoc, Timestamp, handleStorageError, OperationType, doc, updateDoc, onSnapshot, query, deleteDoc } from '../lib/storage';
import { User } from '../types';
import { updateMissionProgress } from '../services/gamificationService';
import { 
  Target, 
  TrendingUp, 
  Zap, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Rocket, 
  Brain, 
  ShieldCheck,
  Clock,
  AlertCircle,
  X,
  Loader2,
  Plane,
  Car,
  Home,
  GraduationCap,
  Star,
  Coins,
  Heart,
  Palette,
  Trophy,
  Award
} from 'lucide-react';

interface GoalSuggestion {
  id: string;
  title: string;
  description: string;
  longDescription?: string;
  duration?: string;
  steps?: string[];
  category: 'Melhoria' | 'Crescimento' | 'Disciplina';
  icon: string;
  color: string;
  isCustom?: boolean;
}

const IconMap: Record<string, React.ElementType> = {
  Target, TrendingUp, Zap, Plus, ArrowRight, CheckCircle2, Rocket, Brain, ShieldCheck,
  Clock, AlertCircle, X, Loader2, Plane, Car, Home, GraduationCap, Star, Coins,
  Heart, Palette, Trophy, Award
};

const goalModels = [
  { id: 'viagem', title: 'Viagem', icon: 'Plane', color: 'text-blue-400', category: 'Crescimento' },
  { id: 'carro', title: 'Carro Novo', icon: 'Car', color: 'text-zinc-400', category: 'Melhoria' },
  { id: 'casa', title: 'Casa Própria', icon: 'Home', color: 'text-emerald-400', category: 'Crescimento' },
  { id: 'estudos', title: 'Educação', icon: 'GraduationCap', color: 'text-purple-400', category: 'Crescimento' },
  { id: 'reserva', title: 'Reserva', icon: 'ShieldCheck', color: 'text-orange-400', category: 'Melhoria' },
  { id: 'investimento', title: 'Investimento', icon: 'Coins', color: 'text-yellow-400', category: 'Disciplina' },
  { id: 'saude', title: 'Saúde', icon: 'Heart', color: 'text-rose-400', category: 'Disciplina' },
  { id: 'outro', title: 'Personalizado', icon: 'Star', color: 'text-cyan-400', category: 'Melhoria' },
];

const suggestions: GoalSuggestion[] = [
  {
    id: 'reserva-emergencia',
    title: 'Reserva de Emergência',
    description: 'Construa um colchão financeiro de 6 meses de gastos.',
    longDescription: 'A reserva de emergência é o alicerce da sua paz financeira. Ela serve para cobrir imprevistos como perda de renda, problemas de saúde ou reparos urgentes, evitando que você recorra a empréstimos caros.',
    duration: '6 a 12 meses',
    steps: [
      'Calcule seu custo de vida mensal essencial',
      'Multiplique por 6 para o valor alvo inicial',
      'Automatize uma transferência mensal para uma conta separada',
      'Mantenha o valor em investimentos de liquidez diária (ex: Tesouro SELIC)'
    ],
    category: 'Melhoria',
    icon: 'ShieldCheck',
    color: 'text-blue-500'
  },
  {
    id: 'investimento-mensal',
    title: 'Investimento Mensal',
    description: 'Aporte pelo menos 15% da sua renda todos os meses.',
    longDescription: 'Pagar-se primeiro é a regra de ouro. Ao investir 15% da sua renda antes de gastar com o resto, você garante que seu patrimônio cresça consistentemente através dos juros compostos.',
    duration: 'Recorrente (Mensal)',
    steps: [
      'Defina o valor exato de 15% do seu salário líquido',
      'Crie um lembrete no Vorix para o dia do recebimento',
      'Diversifique entre Renda Fixa e Variável conforme seu perfil',
      'Reinvista os dividendos recebidos'
    ],
    category: 'Disciplina',
    icon: 'Zap',
    color: 'text-orange-500'
  },
  {
    id: 'liberdade-financeira',
    title: 'Liberdade Financeira',
    description: 'Aumente seu patrimônio investido em 25% este ano.',
    longDescription: 'A liberdade financeira acontece quando sua renda passiva cobre seus gastos. Aumentar seu patrimônio em 25% em um ano exige foco em aumentar aportes e buscar rentabilidade inteligente.',
    duration: '12 meses',
    steps: [
      'Faça um inventário de todos os seus ativos atuais',
      'Calcule quanto falta para atingir a meta de +25%',
      'Busque fontes de renda extra para acelerar os aportes',
      'Revise sua carteira trimestralmente'
    ],
    category: 'Crescimento',
    icon: 'Rocket',
    color: 'text-emerald-500'
  },
  {
    id: 'educacao-financeira',
    title: 'Educação Financeira',
    description: 'Leia 1 livro de finanças ou faça um curso por trimestre.',
    longDescription: 'O melhor investimento é em você mesmo. O conhecimento financeiro permite que você tome decisões melhores, evite golpes e entenda como o dinheiro trabalha para você.',
    duration: '3 meses por ciclo',
    steps: [
      'Escolha um tema (ex: Ações, FIIs, Mindset)',
      'Selecione um livro ou curso renomado',
      'Dedique 20 minutos por dia aos estudos',
      'Aplique pelo menos um aprendizado prático no seu Vorix'
    ],
    category: 'Crescimento',
    icon: 'Brain',
    color: 'text-purple-500'
  },
  {
    id: 'controle-gastos',
    title: 'Controle de Gastos',
    description: 'Reduza em 20% os gastos com assinaturas e lazer supérfluo.',
    longDescription: 'Pequenos vazamentos afundam grandes navios. Cortar 20% de gastos não essenciais libera capital para seus sonhos maiores sem sacrificar drasticamente sua qualidade de vida.',
    duration: '30 a 90 dias',
    steps: [
      'Liste todas as assinaturas recorrentes no Vorix',
      'Cancele o que não usou nos últimos 30 dias',
      'Negocie planos de internet e celular',
      'Estabeleça um teto semanal para lazer'
    ],
    category: 'Melhoria',
    icon: 'Target',
    color: 'text-rose-500'
  },
  {
    id: 'habito-registro',
    title: 'Hábito de Registro',
    description: 'Anote todas as suas despesas no Vorix por 60 dias seguidos.',
    longDescription: 'O que não é medido não é gerenciado. Criar o hábito de registrar cada centavo gasto traz clareza mental e controle absoluto sobre sua vida financeira.',
    duration: '60 dias',
    steps: [
      'Registre gastos imediatamente após a compra',
      'Use as categorias do Vorix para classificar tudo',
      'Revise seu extrato semanalmente no Dashboard',
      'Celebre ao completar a primeira semana de registros'
    ],
    category: 'Disciplina',
    icon: 'CheckCircle2',
    color: 'text-cyan-500'
  }
];

interface GoalsViewProps {
  user: User;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ user }) => {
  const [activeGoals, setActiveGoals] = useState<string[]>([]);
  const [customGoals, setCustomGoals] = useState<GoalSuggestion[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoalForDetails, setSelectedGoalForDetails] = useState<GoalSuggestion | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState<{title: string, icon: any} | null>(null);
  
  // Load goals from Firestore
  React.useEffect(() => {
    if (!user) return;
    const goalsRef = collection(db, `users/${user.uid}/goals`);
    const unsubscribe = onSnapshot(goalsRef, (snapshot) => {
      const goalsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Separate custom goals and active goals
      const custom = goalsData.filter(g => g.isCustom);
      const active = goalsData.map(g => g.id);
      
      setCustomGoals(custom);
      setActiveGoals(active);
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/goals`);
    });
    
    return () => unsubscribe();
  }, [user]);
  
  // Form state
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'Crescimento' as GoalSuggestion['category'],
    modelId: 'viagem'
  });

  const allGoals = [...suggestions, ...customGoals];

  const toggleGoal = async (id: string) => {
    if (!user) return;
    const isActivating = !activeGoals.includes(id);
    const goal = allGoals.find(s => s.id === id);

    try {
      if (isActivating) {
        if (goal) {
          // If it's a suggestion, we store it in Firestore to mark it as active
          await addDoc(collection(db, `users/${user.uid}/goals`), {
            ...goal,
            id: goal.id, // Keep the same ID for suggestions
            createdAt: Timestamp.now()
          });
          setNotification(`Meta "${goal.title}" ativada com sucesso!`);
          
          // Show details modal after activation
          setSelectedGoalForDetails(goal);
        }
      } else {
        // Find the doc in Firestore and delete it
        const goalsRef = collection(db, `users/${user.uid}/goals`);
        const q = query(goalsRef); // We'll need to find the doc by its ID field or Firestore ID
        // Actually, it's easier if we use the goal ID as the Firestore doc ID
        await deleteDoc(doc(db, `users/${user.uid}/goals`, id));
        setNotification(`Meta "${goal?.title}" desativada.`);
      }
    } catch (error) {
      handleStorageError(error, isActivating ? OperationType.CREATE : OperationType.DELETE, `users/${user.uid}/goals`);
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const completeGoal = async (id: string) => {
    if (!user) return;
    const goal = allGoals.find(s => s.id === id);
    if (!goal) return;

    setIsCompleting(id);
    try {
      // 1. Update user score
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        vorixScore: (user.vorixScore || 0) + 10
      });

      // 2. Create an achievement in missions collection
      await addDoc(collection(db, `users/${user.uid}/missions`), {
        title: `Conquistador: ${goal.title}`,
        description: `Você concluiu com sucesso a meta: ${goal.description}`,
        completed: true,
        reward: 20, // Further reduced reward for goals
        type: 'achievement',
        icon: goal.id.includes('custom') ? 'Star' : goal.id,
        completedAt: Timestamp.now()
      });

      // 3. Remove from goals collection
      await deleteDoc(doc(db, `users/${user.uid}/goals`, id));

      // Celebration!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fb923c', '#ffffff', '#fbbf24']
      });

      setShowCelebration({ title: goal.title, icon: goal.icon });
      
      setNotification(`Parabéns! Meta "${goal.title}" concluída! +10 PONTOS!`);
      
      setTimeout(() => setShowCelebration(null), 5000);
    } catch (error) {
      handleStorageError(error, OperationType.CREATE, `users/${user.uid}/missions`);
    } finally {
      setIsCompleting(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.title || !user) return;

    const model = goalModels.find(m => m.id === newGoal.modelId) || goalModels[0];
    
    const goalId = `custom-${Date.now()}`;
    const goal = {
      title: newGoal.title,
      description: newGoal.description || `Objetivo personalizado de ${model.title}`,
      category: newGoal.category,
      icon: model.icon, // Store icon name string
      color: model.color,
      isCustom: true,
      createdAt: Timestamp.now()
    };

    try {
      await addDoc(collection(db, `users/${user.uid}/goals`), goal);
      setIsModalOpen(false);
      setNewGoal({ title: '', description: '', category: 'Crescimento', modelId: 'viagem' });
      setNotification(`Meta "${goal.title}" criada e ativada!`);
      
      // Track mission progress
      updateMissionProgress(user.uid, 'Planejador de Metas');
    } catch (error) {
      handleStorageError(error, OperationType.CREATE, `users/${user.uid}/goals`);
    }
    
    setTimeout(() => setNotification(null), 3000);
  };

  const activeItems = allGoals.filter(s => activeGoals.includes(s.id));

  return (
    <div className="space-y-6 lg:space-y-12 pb-20 relative">
      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="bg-zinc-950/90 border border-orange-500/30 p-6 lg:p-12 rounded-3xl lg:rounded-[40px] shadow-2xl backdrop-blur-xl flex flex-col items-center space-y-3 lg:space-y-6 max-w-sm lg:max-w-md text-center"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-yellow-500 blur-2xl opacity-20 rounded-full"
                />
                <div className="relative w-14 h-14 lg:w-24 lg:h-24 bg-orange-600 rounded-xl lg:rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-600/40">
                  <Trophy className="w-7 h-7 lg:w-12 lg:h-12 text-white" />
                </div>
              </div>
              
              <div className="space-y-1 lg:space-y-2">
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-orange-500 font-bold uppercase tracking-[0.2em] lg:tracking-[0.3em] text-[9px] lg:text-xs"
                >
                  Nova Conquista
                </motion.p>
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg lg:text-3xl font-black text-white"
                >
                  {showCelebration.title}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-zinc-400 text-[10px] lg:text-sm"
                >
                  Você provou sua disciplina financeira. Mais um passo rumo à liberdade!
                </motion.p>
              </div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center space-x-2 px-3 py-1 lg:px-4 lg:py-2 bg-zinc-900 border border-zinc-800 rounded-full"
              >
                <Award className="w-3 h-3 lg:w-4 lg:h-4 text-yellow-500" />
                <span className="text-yellow-500 font-bold text-[10px] lg:text-sm">+30 PONTOS</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl lg:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 lg:p-8 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/50">
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 lg:p-2 bg-orange-600 rounded-lg lg:rounded-xl">
                    <Plus className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-white" />
                  </div>
                  <h3 className="text-base lg:text-2xl font-bold">Nova Meta</h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
                >
                  <X className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="p-4 lg:p-8 space-y-5 lg:space-y-8 overflow-y-auto">
                {/* Title & Description */}
                <div className="space-y-3 lg:space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Título da Meta</label>
                    <input 
                      type="text"
                      required
                      placeholder="Ex: Viagem para o Japão"
                      value={newGoal.title}
                      onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl px-4 lg:px-6 py-2.5 lg:py-4 focus:outline-none focus:border-orange-500 transition-colors text-xs lg:text-base text-white placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Descrição (Opcional)</label>
                    <textarea 
                      placeholder="Ex: Economizar R$ 15.000 para as passagens e hospedagem."
                      value={newGoal.description}
                      onChange={e => setNewGoal({...newGoal, description: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl lg:rounded-2xl px-4 lg:px-6 py-2.5 lg:py-4 focus:outline-none focus:border-orange-500 transition-colors text-xs lg:text-base text-white placeholder:text-zinc-600 min-h-[60px] lg:min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-2 lg:space-y-4">
                  <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Escolha um Modelo</label>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-2 lg:gap-3">
                    {goalModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setNewGoal({...newGoal, modelId: model.id})}
                        className={`aspect-square rounded-lg lg:rounded-2xl border flex items-center justify-center transition-all ${
                          newGoal.modelId === model.id 
                            ? 'bg-orange-600 border-orange-500 shadow-lg shadow-orange-600/20 scale-105' 
                            : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {(() => {
                          const Icon = IconMap[model.icon] || Star;
                          return <Icon className={`w-4 h-4 lg:w-6 lg:h-6 ${newGoal.modelId === model.id ? 'text-white' : model.color}`} />;
                        })()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category Selection */}
                <div className="space-y-2 lg:space-y-4">
                  <label className="text-[9px] lg:text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Categoria</label>
                  <div className="grid grid-cols-3 gap-2 lg:gap-3">
                    {(['Melhoria', 'Crescimento', 'Disciplina'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewGoal({...newGoal, category: cat})}
                        className={`py-2 lg:py-3 rounded-lg lg:rounded-xl border text-[9px] lg:text-xs font-bold transition-all ${
                          newGoal.category === cat 
                            ? 'bg-zinc-100 border-white text-black' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 lg:pt-4">
                  <button 
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 lg:py-5 rounded-xl lg:rounded-2xl font-bold text-sm lg:text-lg transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center space-x-2 lg:space-x-3"
                  >
                    <CheckCircle2 className="w-4 h-4 lg:w-6 lg:h-6" />
                    <span>Criar e Ativar Meta</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50 bg-orange-600 text-white px-5 py-2.5 lg:px-6 lg:py-3 rounded-xl lg:rounded-2xl shadow-2xl font-bold text-xs lg:text-sm flex items-center space-x-2 lg:space-x-3"
          >
            <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="space-y-1 lg:space-y-2">
        <h2 className="text-2xl lg:text-4xl font-bold tracking-tight">Minhas Metas</h2>
        <p className="text-zinc-500 text-xs lg:text-lg leading-relaxed">Defina objetivos claros para transformar sua vida financeira.</p>
      </div>

      {/* Active Goals Reminder Section */}
      {activeItems.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-orange-600/10 border border-orange-500/20 rounded-2xl lg:rounded-3xl p-3 lg:p-8 space-y-3 lg:space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 lg:space-x-3">
              <div className="p-1.5 lg:p-2 bg-orange-600 rounded-lg lg:rounded-xl">
                <Clock className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xs lg:text-xl font-bold text-white">Metas Ativas</h3>
                <p className="text-orange-500/70 text-[8px] lg:text-sm">Você tem {activeItems.length} meta(s) em andamento.</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-orange-500 text-[10px] font-bold uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Foco no Objetivo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-4">
            {activeItems.map(goal => {
              const Icon = IconMap[goal.icon] || Star;
              return (
                <div key={goal.id} className="bg-zinc-950/50 border border-orange-500/10 p-2 lg:p-4 rounded-xl lg:rounded-2xl flex items-center justify-between group">
                  <div className="flex items-center space-x-2 lg:space-x-4">
                    <div className={`p-1 lg:p-2 rounded-lg bg-zinc-900 ${goal.color}`}>
                      <Icon className="w-3 h-3 lg:w-5 lg:h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-[10px] lg:text-sm truncate max-w-[100px] lg:max-w-none">{goal.title}</p>
                      <p className="text-zinc-500 text-[8px] lg:text-[10px]">Em progresso...</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 lg:space-x-2">
                    <button 
                      onClick={() => completeGoal(goal.id)}
                      disabled={isCompleting === goal.id}
                      className="px-1.5 py-0.5 lg:px-3 lg:py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[8px] lg:text-xs font-bold transition-all flex items-center space-x-1 disabled:opacity-50"
                    >
                      {isCompleting === goal.id ? (
                        <Loader2 className="w-2 h-2 lg:w-3 lg:h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-2 h-2 lg:w-3 lg:h-3" />
                      )}
                      <span>Concluir</span>
                    </button>
                    <button 
                      onClick={() => toggleGoal(goal.id)}
                      className="p-1 lg:p-2 hover:bg-rose-500/10 rounded-lg text-zinc-600 hover:text-rose-500 transition-all"
                    >
                      <X className="w-3 h-3 lg:w-4 lg:h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Create Custom Goal Button */}
      <motion.button 
        onClick={() => setIsModalOpen(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full border-2 border-dashed border-zinc-800 rounded-2xl lg:rounded-3xl p-4 lg:p-10 flex flex-col items-center justify-center space-y-1.5 lg:space-y-4 hover:border-orange-500/50 hover:bg-orange-600/5 transition-all group"
      >
        <div className="w-8 h-8 lg:w-16 lg:h-16 bg-zinc-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-all border border-zinc-800 group-hover:border-orange-500/30">
          <Plus className="w-4 h-4 lg:w-8 lg:h-8 text-zinc-500 group-hover:text-orange-500" />
        </div>
        <div className="text-center">
          <p className="font-bold text-xs lg:text-xl text-zinc-300 group-hover:text-white transition-colors">Criar Meta Personalizada</p>
          <p className="text-zinc-600 text-[8px] lg:text-sm mt-0.5 lg:mt-1">Viagem, Carro Novo, Casa Própria ou qualquer outro sonho.</p>
        </div>
      </motion.button>

      {/* Custom Goals List (if any) */}
      {customGoals.length > 0 && (
        <div className="space-y-4 lg:space-y-8">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg lg:rounded-xl">
              <Palette className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
            </div>
            <h3 className="text-base lg:text-2xl font-bold">Minhas Metas Personalizadas</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
            {customGoals.map((goal, i) => {
              const isActive = activeGoals.includes(goal.id);
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={goal.id}
                  className={`border transition-all group relative overflow-hidden p-4 lg:p-8 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-6 ${
                    isActive 
                      ? 'bg-emerald-600/10 border-emerald-500 shadow-lg shadow-emerald-500/10' 
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 lg:px-2.5 lg:py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[7px] lg:text-[10px] font-bold uppercase tracking-widest text-zinc-400`}>
                      {goal.category}
                    </span>
                    {(() => {
                      const Icon = IconMap[goal.icon] || Star;
                      return <Icon className={`w-3.5 h-3.5 lg:w-6 lg:h-6 ${goal.color} ${isActive ? 'opacity-100' : 'opacity-80'}`} />;
                    })()}
                  </div>

                  <div className="space-y-0.5 lg:space-y-2">
                    <h4 className={`text-xs lg:text-xl font-bold ${isActive ? 'text-emerald-500' : 'group-hover:text-orange-500'} transition-colors`}>{goal.title}</h4>
                    <p className="text-zinc-500 text-[10px] lg:text-sm leading-relaxed">{goal.description}</p>
                  </div>

                  <div className="flex space-x-2">
                    <button 
                      onClick={() => {
                        if (isActive) {
                          setSelectedGoalForDetails(goal);
                        } else {
                          toggleGoal(goal.id);
                        }
                      }}
                      className={`flex-1 py-1.5 lg:py-3 rounded-lg lg:rounded-xl text-[9px] lg:text-sm font-bold transition-all flex items-center justify-center space-x-1 lg:space-x-2 group/btn ${
                        isActive 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-zinc-800 hover:bg-orange-600 text-white'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 lg:w-4 lg:h-4" />
                          <span>Meta Ativada</span>
                        </>
                      ) : (
                        <>
                          <span>Ativar</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => {
                        setCustomGoals(customGoals.filter(g => g.id !== goal.id));
                        setActiveGoals(activeGoals.filter(id => id !== goal.id));
                      }}
                      className="p-1.5 lg:p-3 bg-zinc-800 hover:bg-rose-500/20 text-zinc-500 hover:text-rose-500 rounded-lg lg:rounded-xl transition-all"
                    >
                      <X className="w-3 h-3 lg:w-5 lg:h-5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestions Section */}
      <div className="space-y-4 lg:space-y-8">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg lg:rounded-xl">
            <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
          </div>
          <h3 className="text-base lg:text-2xl font-bold">Sugestões Vorix</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
          {suggestions.map((goal, i) => {
            const isActive = activeGoals.includes(goal.id);
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                key={goal.id}
                className={`border transition-all group relative overflow-hidden p-4 lg:p-8 rounded-2xl lg:rounded-3xl space-y-3 lg:space-y-6 ${
                  isActive 
                    ? 'bg-emerald-600/10 border-emerald-500 shadow-lg shadow-emerald-500/10' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Category Badge */}
                <div className="flex items-center justify-between">
                  <span className={`px-1.5 py-0.5 lg:px-2.5 lg:py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[7px] lg:text-[10px] font-bold uppercase tracking-widest text-zinc-400`}>
                    {goal.category}
                  </span>
                  {(() => {
                    const Icon = IconMap[goal.icon] || Star;
                    return <Icon className={`w-3.5 h-3.5 lg:w-6 lg:h-6 ${goal.color} ${isActive ? 'opacity-100' : 'opacity-80'}`} />;
                  })()}
                </div>

                <div className="space-y-0.5 lg:space-y-2">
                  <h4 className={`text-xs lg:text-xl font-bold ${isActive ? 'text-emerald-500' : 'group-hover:text-orange-500'} transition-colors`}>{goal.title}</h4>
                  <p className="text-zinc-500 text-[10px] lg:text-sm leading-relaxed">{goal.description}</p>
                </div>

                <button 
                  onClick={() => {
                    if (isActive) {
                      setSelectedGoalForDetails(goal);
                    } else {
                      toggleGoal(goal.id);
                    }
                  }}
                  className={`w-full py-1.5 lg:py-3 rounded-lg lg:rounded-xl text-[9px] lg:text-sm font-bold transition-all flex items-center justify-center space-x-1 lg:space-x-2 group/btn ${
                    isActive 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-zinc-800 hover:bg-orange-600 text-white'
                  }`}
                >
                  {isActive ? (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5 lg:w-4 lg:h-4" />
                      <span>Meta Ativada</span>
                    </>
                  ) : (
                    <>
                      <span>Ativar esta Meta</span>
                      <ArrowRight className="w-2.5 h-2.5 lg:w-4 lg:h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                {/* Decorative Gradient */}
                <div className={`absolute -right-4 -bottom-4 w-16 h-16 lg:w-24 lg:h-24 ${isActive ? 'bg-orange-600/20' : 'bg-orange-600/5'} blur-3xl rounded-full group-hover:bg-orange-600/10 transition-all`} />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Philosophy Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-6 pt-4 lg:pt-8">
        {[
          { title: 'Melhoria', desc: 'Ajuste seus hábitos atuais para otimizar seu fluxo de caixa.', icon: Target },
          { title: 'Crescimento', desc: 'Foque em expandir seu patrimônio e conhecimento.', icon: Rocket },
          { title: 'Disciplina', desc: 'A constância é o que separa o sonho da realidade.', icon: ShieldCheck },
        ].map((item, i) => (
          <div key={i} className="p-4 lg:p-6 bg-zinc-900/30 border border-zinc-800/50 rounded-xl lg:rounded-2xl space-y-2 lg:space-y-3">
            <div className="flex items-center space-x-2">
              <item.icon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-orange-500" />
              <h5 className="font-bold text-[10px] lg:text-sm uppercase tracking-wider">{item.title}</h5>
            </div>
            <p className="text-[10px] lg:text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Goal Details Modal */}
      <AnimatePresence>
        {selectedGoalForDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6"
          >
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedGoalForDetails(null)} />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-zinc-950 border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 lg:p-8 border-b border-zinc-900 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-emerald-500/20 rounded-2xl">
                    {(() => {
                      const Icon = IconMap[selectedGoalForDetails.icon] || Star;
                      return <Icon className="w-6 h-6 text-emerald-500" />;
                    })()}
                  </div>
                  <div>
                    <h3 className="text-xl lg:text-2xl font-black text-white">{selectedGoalForDetails.title}</h3>
                    <p className="text-emerald-500 text-[10px] lg:text-xs font-bold uppercase tracking-widest">Meta Ativada com Sucesso</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedGoalForDetails(null)}
                  className="p-2 hover:bg-zinc-900 rounded-full text-zinc-500 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="space-y-2 lg:space-y-4">
                  <h4 className="text-[10px] lg:text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">O que é esta meta?</h4>
                  <p className="text-zinc-300 text-sm lg:text-lg leading-relaxed font-medium">
                    {selectedGoalForDetails.longDescription || selectedGoalForDetails.description}
                  </p>
                </div>

                {selectedGoalForDetails.duration && (
                  <div className="flex items-center space-x-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Duração Estimada</p>
                      <p className="text-white font-bold">{selectedGoalForDetails.duration}</p>
                    </div>
                  </div>
                )}

                {selectedGoalForDetails.steps && (
                  <div className="space-y-4 lg:space-y-6">
                    <h4 className="text-[10px] lg:text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Passo a Passo para o Sucesso</h4>
                    <div className="space-y-3 lg:space-y-4">
                      {selectedGoalForDetails.steps.map((step, idx) => (
                        <div key={idx} className="flex items-start space-x-4 group">
                          <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] lg:text-xs font-black text-emerald-500">{idx + 1}</span>
                          </div>
                          <p className="text-zinc-400 text-xs lg:text-base font-medium group-hover:text-white transition-colors">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 lg:pt-6">
                  <button 
                    onClick={() => setSelectedGoalForDetails(null)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 lg:py-5 rounded-2xl font-black text-sm lg:text-lg transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center space-x-3"
                  >
                    <CheckCircle2 className="w-5 h-5 lg:w-6 lg:h-6" />
                    <span>ENTENDI, VAMOS NESSA!</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
