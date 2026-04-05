import { db, collection, addDoc, getDocs, getDoc, query, where, updateDoc, deleteDoc, doc, Timestamp, OperationType, handleStorageError } from '../lib/storage';
import { User, Mission, Badge } from '../types';

const INITIAL_MISSIONS: Omit<Mission, 'id'>[] = [
  {
    title: 'Primeira Meta',
    description: 'Junte seus primeiros R$ 1.000,00 em saldo total.',
    completed: false,
    reward: 50,
    type: 'mission',
    icon: '💰',
    category: 'finance',
    target: 1000,
    current: 0,
    notified: false
  },
  {
    title: 'Mestre do Saldo',
    description: 'Alcance R$ 5.000,00 em saldo total.',
    completed: false,
    reward: 50,
    type: 'mission',
    icon: '💎',
    category: 'finance',
    target: 5000,
    current: 0,
    notified: false
  },
  {
    title: 'Paciência de Ouro',
    description: 'Mantenha pelo menos R$ 500,00 em conta por 30 dias seguidos.',
    completed: false,
    reward: 50,
    type: 'mission',
    icon: '⏳',
    category: 'finance',
    target: 30,
    current: 0,
    notified: false
  },
  {
    title: 'Organizador Nato',
    description: 'Crie 5 notas de planejamento financeiro.',
    completed: false,
    reward: 15,
    type: 'mission',
    icon: '📝',
    category: 'gamification',
    target: 5,
    current: 0,
    notified: false
  },
  {
    title: 'Escritor Vorix',
    description: 'Crie 15 notas de planejamento financeiro.',
    completed: false,
    reward: 30,
    type: 'mission',
    icon: '📚',
    category: 'gamification',
    target: 15,
    current: 0,
    notified: false
  },
  {
    title: 'Primeira Transação',
    description: 'Registre sua primeira movimentação no Vorix.',
    completed: false,
    reward: 10,
    type: 'mission',
    icon: '⚡',
    category: 'finance',
    target: 1,
    current: 0,
    notified: false
  },
  {
    title: 'Mestre das Receitas',
    description: 'Registre sua primeira entrada de dinheiro.',
    completed: false,
    reward: 20,
    type: 'mission',
    icon: '📈',
    category: 'finance',
    target: 1,
    current: 0,
    notified: false
  },
  {
    title: 'Explorador de Radar',
    description: 'Acompanhe o mercado no Radar por 5 vezes.',
    completed: false,
    reward: 15,
    type: 'mission',
    icon: '📡',
    category: 'gamification',
    target: 5,
    current: 0,
    notified: false
  },
  {
    title: 'Analista de Radar',
    description: 'Acompanhe o mercado no Radar por 20 vezes.',
    completed: false,
    reward: 40,
    type: 'mission',
    icon: '🔭',
    category: 'gamification',
    target: 20,
    current: 0,
    notified: false
  },
  {
    title: 'Planejador de Metas',
    description: 'Ative 3 metas financeiras para o seu futuro.',
    completed: false,
    reward: 30,
    type: 'mission',
    icon: '🎯',
    category: 'finance',
    target: 3,
    current: 0,
    notified: false
  },
  {
    title: 'Visionário',
    description: 'Ative 7 metas financeiras para o seu futuro.',
    completed: false,
    reward: 50,
    type: 'mission',
    icon: '🚀',
    category: 'finance',
    target: 7,
    current: 0,
    notified: false
  },
  {
    title: 'Diversificador',
    description: 'Cadastre 5 contas ou cartões diferentes.',
    completed: false,
    reward: 25,
    type: 'mission',
    icon: '💳',
    category: 'finance',
    target: 5,
    current: 0,
    notified: false
  },
  {
    title: 'Economista Vorix',
    description: 'Alcance R$ 10.000,00 em saldo total.',
    completed: false,
    reward: 40,
    type: 'mission',
    icon: '🏦',
    category: 'finance',
    target: 10000,
    current: 0,
    notified: false
  },
  {
    title: 'Investidor Iniciante',
    description: 'Cadastre 3 fontes de renda diferentes.',
    completed: false,
    reward: 25,
    type: 'mission',
    icon: '🌱',
    category: 'finance',
    target: 3,
    current: 0,
    notified: false
  },
  {
    title: 'Mestre da Poupança',
    description: 'Tenha pelo menos 3 contas do tipo "poupanca" ou "investimento".',
    completed: false,
    reward: 30,
    type: 'mission',
    icon: '🏦',
    category: 'finance',
    target: 3,
    current: 0,
    notified: false
  },
  {
    title: 'Fidelidade Vorix',
    description: 'Acesse o app por 7 dias seguidos (simulado por transações em dias diferentes).',
    completed: false,
    reward: 50,
    type: 'mission',
    icon: '🗓️',
    category: 'gamification',
    target: 7,
    current: 0,
    notified: false
  }
];

const INITIAL_ACHIEVEMENTS: Omit<Mission, 'id'>[] = [
  {
    title: 'Curiosidade Vorix',
    description: 'Faça 15 perguntas para a IA Vorix.',
    completed: false,
    reward: 20,
    type: 'achievement',
    icon: '🤖',
    category: 'social',
    target: 15,
    current: 0,
    notified: false
  },
  {
    title: 'IA Expert',
    description: 'Faça 50 perguntas para a IA Vorix.',
    completed: false,
    reward: 40,
    type: 'achievement',
    icon: '🧠',
    category: 'social',
    target: 50,
    current: 0,
    notified: false
  },
  {
    title: 'Histórico Ativo',
    description: 'Registre 100 transações no total.',
    completed: false,
    reward: 35,
    type: 'achievement',
    icon: '📊',
    category: 'finance',
    target: 100,
    current: 0,
    notified: false
  },
  {
    title: 'Transacionador Serial',
    description: 'Registre 300 transações no total.',
    completed: false,
    reward: 50,
    type: 'achievement',
    icon: '🔥',
    category: 'finance',
    target: 300,
    current: 0,
    notified: false
  },
  {
    title: 'Meta Alcançada',
    description: 'Complete sua primeira meta financeira.',
    completed: false,
    reward: 20,
    type: 'achievement',
    icon: '🎯',
    category: 'finance',
    target: 1,
    current: 0,
    notified: false
  }
];

export const initializeUserGamification = async (userId: string) => {
  try {
    const missionsRef = collection(db, `users/${userId}/missions`);
    const snapshot = await getDocs(missionsRef);
    const allSeeds = [...INITIAL_MISSIONS, ...INITIAL_ACHIEVEMENTS];
    
    if (snapshot.empty) {
      for (const seed of allSeeds) {
        await addDoc(missionsRef, seed);
      }
    } else {
      const processedTitles = new Set<string>();
      
      // 1. Process existing missions: delete duplicates/old, sync/repair valid ones
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Mission;
        const seed = allSeeds.find(s => s.title === data.title);
        
        // If mission not in current seed list OR it's a duplicate title
        if (!seed || processedTitles.has(data.title)) {
          console.log(`Deleting old/duplicate mission: ${data.title}`);
          await deleteDoc(doc(db, `users/${userId}/missions`, docSnap.id));
          continue;
        }

        // Valid mission, mark as processed and sync/repair
        processedTitles.add(data.title);
        const updates: any = {};
        
        // Check for reward mismatch
        if (data.reward !== seed.reward) {
          updates.reward = seed.reward;
        }
        
        // Repair missing fields that are required by security rules
        if (!data.description) updates.description = seed.description;
        if (!data.type) updates.type = seed.type;
        if (!data.icon) updates.icon = seed.icon;
        if (!data.category) updates.category = seed.category;
        if (data.completed === undefined) updates.completed = false;

        if (Object.keys(updates).length > 0) {
          console.log(`Syncing/Repairing mission ${data.title}:`, updates);
          await updateDoc(doc(db, `users/${userId}/missions`, docSnap.id), updates);
        }
      }

      // 2. Add missing missions
      for (const seed of allSeeds) {
        if (!processedTitles.has(seed.title)) {
          console.log(`Adding missing mission: ${seed.title}`);
          await addDoc(missionsRef, seed);
        }
      }
    }
  } catch (error) {
    handleStorageError(error, OperationType.WRITE, `users/${userId}/missions`);
  }
};

export const checkScoreReward = async (userId: string, currentScore: number) => {
  if (currentScore >= 5000) {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as User;
        // Check if reward already claimed AND if user has paid at least once
        if (!userData.vorixRewardClaimed && userData.isPaid) {
          const currentTrialEnd = userData.trialEndsAt?.toDate() || new Date();
          // Add 30 days
          const newTrialEnd = new Date(currentTrialEnd.getTime() + (30 * 24 * 60 * 60 * 1000));
          
          await updateDoc(userRef, {
            trialEndsAt: Timestamp.fromDate(newTrialEnd),
            subscriptionStatus: 'active',
            vorixRewardClaimed: true
          });
          
          // Add notification
          await addDoc(collection(db, `users/${userId}/alerts`), {
            type: 'success',
            title: 'Recompensa Vorix!',
            message: 'Parabéns! Você atingiu 5000 pontos e ganhou 1 mês grátis de Vorix Premium por ser um assinante fiel.',
            severity: 'high',
            read: false,
            createdAt: Timestamp.now()
          });
        }
      }
    } catch (error) {
      console.error('Error claiming score reward:', error);
    }
  }
};

export const updateMissionProgress = async (userId: string, missionTitle: string, increment: number = 1) => {
  try {
    const missionsRef = collection(db, `users/${userId}/missions`);
    const q = query(missionsRef, where('title', '==', missionTitle), where('completed', '==', false));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const missionDoc = snapshot.docs[0];
      const data = missionDoc.data() as Mission;
      const newCurrent = (data.current || 0) + increment;
      const isCompleted = newCurrent >= (data.target || 1);
      
      await updateDoc(doc(db, `users/${userId}/missions`, missionDoc.id), {
        current: newCurrent,
        completed: isCompleted,
        completedAt: isCompleted ? Timestamp.now() : null
      });

      if (isCompleted) {
        // Update user score
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as User;
          const newScore = (userData.vorixScore || 0) + data.reward;
          await updateDoc(userRef, {
            vorixScore: newScore
          });
          
          // Check for reward
          await checkScoreReward(userId, newScore);
        }
      }
    }
  } catch (error) {
    handleStorageError(error, OperationType.UPDATE, `users/${userId}/missions`);
  }
};

export const checkAndUnlockBadge = async (userId: string, badgeName: string, icon: string, description: string) => {
  try {
    const badgesRef = collection(db, `users/${userId}/badges`);
    const q = query(badgesRef, where('name', '==', badgeName));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      await addDoc(badgesRef, {
        name: badgeName,
        description,
        icon,
        unlockedAt: Timestamp.now()
      });
      return true;
    }
    return false;
  } catch (error) {
    handleStorageError(error, OperationType.WRITE, `users/${userId}/badges`);
    return false;
  }
};

export const setMissionProgress = async (userId: string, missionTitle: string, value: number) => {
  try {
    const missionsRef = collection(db, `users/${userId}/missions`);
    const q = query(missionsRef, where('title', '==', missionTitle), where('completed', '==', false));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const missionDoc = snapshot.docs[0];
      const data = missionDoc.data() as Mission;
      const isCompleted = value >= (data.target || 1);
      
      // Only update if value is different to avoid unnecessary writes
      if (data.current !== value) {
        await updateDoc(doc(db, `users/${userId}/missions`, missionDoc.id), {
          current: value,
          completed: isCompleted,
          completedAt: isCompleted ? Timestamp.now() : null
        });

        if (isCompleted) {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as User;
            const newScore = (userData.vorixScore || 0) + data.reward;
            await updateDoc(userRef, {
              vorixScore: newScore
            });
            
            // Check for reward
            await checkScoreReward(userId, newScore);
          }
        }
      }
    }
  } catch (error) {
    handleStorageError(error, OperationType.UPDATE, `users/${userId}/missions`);
  }
};

export const markMissionAsNotified = async (userId: string, missionId: string) => {
  try {
    await updateDoc(doc(db, `users/${userId}/missions`, missionId), {
      notified: true
    });
  } catch (error) {
    handleStorageError(error, OperationType.UPDATE, `users/${userId}/missions/${missionId}`);
  }
};

export const checkMilestones = async (user: User, accounts: any[], transactions: any[], notes: any[] = [], goals: any[] = []) => {
  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const transactionCount = transactions.length;
  const incomeCount = transactions.filter(t => t.type === 'income').length;
  const accountCount = accounts.length;
  const noteCount = notes.length;
  const goalCount = goals.length;

  // 1. Missão: Primeira Meta (R$ 1000)
  await setMissionProgress(user.uid, 'Primeira Meta', totalBalance);

  // 2. Missão: Mestre do Saldo (R$ 5000)
  await setMissionProgress(user.uid, 'Mestre do Saldo', totalBalance);

  // 3. Missão: Histórico Ativo (100 transações)
  await setMissionProgress(user.uid, 'Histórico Ativo', transactionCount);

  // 4. Missão: Transacionador Serial (300 transações)
  await setMissionProgress(user.uid, 'Transacionador Serial', transactionCount);

  // 5. Missão: Primeira Transação
  await setMissionProgress(user.uid, 'Primeira Transação', transactionCount);

  // 6. Missão: Mestre das Receitas
  await setMissionProgress(user.uid, 'Mestre das Receitas', incomeCount);

  // 7. Missão: Diversificador (5 contas)
  await setMissionProgress(user.uid, 'Diversificador', accountCount);

  // 8. Missão: Organizador Nato (5 notas)
  await setMissionProgress(user.uid, 'Organizador Nato', noteCount);

  // 9. Missão: Escritor Vorix (15 notas)
  await setMissionProgress(user.uid, 'Escritor Vorix', noteCount);

  // 10. Missão: Planejador de Metas (3 metas)
  await setMissionProgress(user.uid, 'Planejador de Metas', goalCount);

  // 11. Missão: Visionário (7 metas)
  await setMissionProgress(user.uid, 'Visionário', goalCount);

  // 12. Missão: Investidor Iniciante (3 fontes de renda)
  const incomeSources = new Set(transactions.filter(t => t.type === 'income').map(t => t.description.toLowerCase()));
  await setMissionProgress(user.uid, 'Investidor Iniciante', incomeSources.size);

  // 13. Missão: Economista Vorix (10k saldo)
  await setMissionProgress(user.uid, 'Economista Vorix', totalBalance);

  // 14. Missão: Mestre da Poupança (3 contas poupança/investimento)
  const savingsAccounts = accounts.filter(a => a.tipo === 'poupanca' || a.tipo === 'investimento').length;
  await setMissionProgress(user.uid, 'Mestre da Poupança', savingsAccounts);

  // 15. Missão: Fidelidade Vorix (7 dias com transações)
  const uniqueDays = new Set(transactions.map(t => {
    const d = t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date);
    return d.toISOString().split('T')[0];
  })).size;
  await setMissionProgress(user.uid, 'Fidelidade Vorix', uniqueDays);

  // 16. Missão: Paciência de Ouro (R$ 500 por 30 dias)
  try {
    const missionsRef = collection(db, `users/${user.uid}/missions`);
    const q = query(missionsRef, where('title', '==', 'Paciência de Ouro'), where('completed', '==', false));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const missionDoc = snapshot.docs[0];
      const data = missionDoc.data() as any;
      
      if (totalBalance >= 500) {
        const now = Date.now();
        const startDate = data.balanceStartDate?.toMillis() || now;
        
        if (!data.balanceStartDate) {
          await updateDoc(doc(db, `users/${user.uid}/missions`, missionDoc.id), {
            balanceStartDate: Timestamp.now(),
            lastBalanceCheck: Timestamp.now()
          });
        } else {
          const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          if (daysPassed > (data.current || 0)) {
            await setMissionProgress(user.uid, 'Paciência de Ouro', daysPassed);
          }
          await updateDoc(doc(db, `users/${user.uid}/missions`, missionDoc.id), {
            lastBalanceCheck: Timestamp.now()
          });
        }
      } else if (data.balanceStartDate) {
        await updateDoc(doc(db, `users/${user.uid}/missions`, missionDoc.id), {
          balanceStartDate: null,
          current: 0
        });
      }
    }
  } catch (error) {
    console.error('Error checking Paciência de Ouro:', error);
  }

  // Badges
  if (totalBalance >= 10000) {
    await checkAndUnlockBadge(user.uid, 'Investidor de Elite', '💎', 'Alcançou um patrimônio de R$ 10.000,00.');
  }

  if (transactionCount >= 50) {
    await checkAndUnlockBadge(user.uid, 'Mestre do Fluxo', '🌊', 'Realizou mais de 50 transações no Vorix.');
  }

  const level = Math.floor((user.vorixScore || 0) / 1000) + 1;
  if (level >= 10) {
    await checkAndUnlockBadge(user.uid, 'Lenda Vorix', '👑', 'Alcançou o nível 10 na plataforma.');
  }
};
