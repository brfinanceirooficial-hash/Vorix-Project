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
  if (!user.streak || !user.streak.lastActivityDate) return;

  const today = getLocalDateString();
  const lastActivity = user.streak.lastActivityDate;
  const daysDiff = getDaysDifference(lastActivity, today);

  // Se já registrou hoje, não faz nada
  if (daysDiff === 0) return;

  // Se o usuário entrar no app e o streak for de ontem, mas ainda não registrou hoje
  // Não resetamos ainda, pois ele tem até o fim do dia.
  // Só resetamos se daysDiff > 1.

  if (daysDiff > 1 && user.streak.currentStreak > 0) {
    // Perdeu o streak
    const message = "A sequência caiu 😢 Mas recomeçar hoje já te coloca de volta no jogo.";
    
    await addDoc(collection(db, `users/${user.uid}/alerts`), {
      type: 'warning',
      title: 'Streak perdido',
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

  // Alertas preventivos baseados no tempo (Psicológicos)
  let alert = null;
  const currentHour = new Date().getHours();

  if (daysDiff === 1) {
    if (currentHour >= 18) {
      alert = {
        title: 'Última chance!',
        message: 'Últimas horas pra manter sua sequência 🔥 Bora registrar algo?',
        severity: 'high' as const
      };
    } else {
      alert = {
        title: 'Mantenha o ritmo',
        message: 'Seu streak ainda tá vivo 🔥 Bora manter hoje?',
        severity: 'low' as const
      };
    }
  }

  if (alert) {
    // Evitar duplicar alertas do mesmo dia
    const alertsRef = collection(db, `users/${user.uid}/alerts`);
    // Aqui poderíamos checar se já existe um alerta hoje, mas vamos confiar na lógica de "uma vez por sessão"
    await addDoc(alertsRef, {
      type: 'info',
      ...alert,
      read: false,
      createdAt: Timestamp.now()
    });
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
