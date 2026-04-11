import { db, updateDoc, doc, addDoc, collection, Timestamp, getDoc } from '../lib/storage';
import { User, Streak } from '../types';

/**
 * HELPER: Retorna a string YYYY-MM-DD local
 */
export const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * HELPER: Retorna a string YYYY-MM-DD de ontem local
 */
export const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
};

/**
 * Calcula a diferença de dias entre duas strings YYYY-MM-DD
 */
export const getDaysDifference = (date1: string, date2: string) => {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Atualiza o streak do usuário após uma atividade (transação)
 */
export const updateStreakOnActivity = async (userId: string, currentStreakData?: Streak) => {
  const today = getLocalDateString();
  const yesterday = getYesterdayDateString();

  let streak = currentStreakData || {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: '',
    streakUpdatedToday: false
  };

  // Se já atualizou hoje, não faz nada
  if (streak.lastActivityDate === today) {
    return streak;
  }

  let newCurrentStreak = 1;
  
  if (streak.lastActivityDate === yesterday) {
    // Incrementa se a última atividade foi ontem
    newCurrentStreak = streak.currentStreak + 1;
  } else if (streak.lastActivityDate === '') {
    // Primeiro registro
    newCurrentStreak = 1;
  } else {
    // Reset se passou mais de 1 dia
    newCurrentStreak = 1;
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  const updatedStreak: Streak = {
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    lastActivityDate: today,
    streakUpdatedToday: true
  };

  // Persistir no DB
  await updateDoc(doc(db, 'users', userId), {
    streak: updatedStreak
  });

  // Verificar recompensas
  await checkStreakRewards(userId, newCurrentStreak);

  return updatedStreak;
};

/**
 * Verifica inatividade e gera alertas
 */
export const checkUserInactivity = async (user: User) => {
  if (!user.uid || !user.streak || !user.streak.lastActivityDate) return;

  const today = getLocalDateString();
  const lastActivity = user.streak.lastActivityDate;
  
  // Se a última atividade foi hoje, o streak está em dia.
  if (lastActivity === today) return;

  const daysDiff = getDaysDifference(lastActivity, today);

  // RESET DE STREAK: Se passou mais de 1 dia sem atividade
  if (daysDiff > 1 && user.streak.currentStreak > 0) {
    // Perdeu o streak
    const message = "Sua sequência de dias foi interrompida 😢 Mas não desanime! Recomeçar hoje é o primeiro passo para o sucesso.";
    
    // Verificar se já notificamos sobre a perda hoje para evitar flood
    // Como vamos resetar o streak abaixo, o user.streak.currentStreak virará 0, 
    // o que impedirá este bloco de rodar novamente até que ele ganhe um novo streak e perca de novo.
    
    await addDoc(collection(db, `users/${user.uid}/alerts`), {
      type: 'warning',
      title: 'Sequência Interrompida',
      message,
      severity: 'medium',
      read: false,
      createdAt: Timestamp.now()
    });

    // Resetar no DB
    await updateDoc(doc(db, 'users', user.uid), {
      streak: {
        ...user.streak,
        currentStreak: 0,
        streakUpdatedToday: false
      }
    });

    return;
  }

  // ALERTAS PREVENTIVOS: Se a última atividade foi ontem (daysDiff === 1) e ainda não registrou hoje
  if (daysDiff === 1) {
    const currentHour = new Date().getHours();
    let alertData = null;

    if (currentHour >= 18) {
      alertData = {
        title: 'Última chance do dia! 🔥',
        message: 'O dia está acabando! Registre sua movimentação agora para não perder sua sequência.',
        severity: 'high' as const
      };
    } else if (currentHour >= 12) {
      alertData = {
        title: 'Mantenha o ritmo! 📈',
        message: 'Não esqueça de registrar seu dia para manter sua sequência Vorix ativa.',
        severity: 'low' as const
      };
    }

    if (alertData) {
      // Evitar duplicar alertas do mesmo tipo e título hoje
      // Para ser performático e evitar loops, vamos usar o localStorage ou uma verificação simples
      const lastNotifyDate = localStorage.getItem(`vorix_notify_streak_${user.uid}`);
      if (lastNotifyDate !== today) {
        await addDoc(collection(db, `users/${user.uid}/alerts`), {
          type: 'info',
          ...alertData,
          read: false,
          createdAt: Timestamp.now()
        });
        localStorage.setItem(`vorix_notify_streak_${user.uid}`, today);
      }
    }
  }
};

/**
 * Sistema de Gamificação (Recompensas)
 */
export const checkStreakRewards = async (userId: string, currentStreak: number) => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  const userData = userSnap.data() as User;
  let scoreBonus = 0;
  let rewardMessage = "";

  if (currentStreak === 3) {
    scoreBonus = 10;
    rewardMessage = "Parabéns! 3 dias seguidos. Você ganhou +10 pontos no Vorix Score! 🔥";
  } else if (currentStreak === 7) {
    scoreBonus = 50;
    rewardMessage = "Incrível! 7 dias de foco total. Você ganhou +50 pontos e uma medalha virtual! 🏆";
    // Nota: A medalha poderia ser cadastrada no badgesRef se houver sistema de badges
  } else if (currentStreak === 30) {
    scoreBonus = 200;
    rewardMessage = "Mestre Vorix! 30 dias de consistência. Você recebeu um bônus gigante de +200 pontos! 👑";
  }

  if (scoreBonus > 0) {
    await updateDoc(userRef, {
      vorixScore: (userData.vorixScore || 0) + scoreBonus
    });

    await addDoc(collection(db, `users/${userId}/alerts`), {
      type: 'success',
      title: 'Recompensa de Streak!',
      message: rewardMessage,
      severity: 'high',
      read: false,
      createdAt: Timestamp.now()
    });
  }
};
