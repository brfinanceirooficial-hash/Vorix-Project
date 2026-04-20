export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // YYYY-MM-DD
  streakUpdatedToday: boolean;
}

export interface User {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
  vorixScore: number;
  isPaid: boolean;
  fixedSalaryAmount: number;
  fixedSalaryDay: number;
  createdAt: any;
  trialEndsAt?: any;
  subscriptionStatus?: 'trialing' | 'active' | 'expired';
  plan?: 'trial' | 'pro' | 'premium';
  mpSubscriptionId?: string;
  mpPayerId?: string;
  couponUsed?: string;
  trialReportUsed?: boolean;
  reportsCount?: number;
  lastReportDate?: string; // YYYY-MM-DD
  aiRequestsCount?: number;
  lastAiRequestDate?: string; // YYYY-MM-DD
  vorixRewardClaimed?: boolean;
  birthDate?: string;
  phone?: string;
  whatsappConnected?: boolean;
  whatsappNumber?: string;
  streak?: Streak;
  onboardingCompleted?: boolean;
}

export interface Account {
  id: string;
  name: string;
  instituicao: string;
  tipo: "corrente" | "poupanca" | "investimento" | "outros";
  balance: number;
  cor: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: any; // Firestore Timestamp
}

export interface Alert {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  read: boolean;
  createdAt: any;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  reward: number;
  type: 'mission' | 'achievement';
  icon: string;
  category: 'finance' | 'gamification' | 'social';
  progress?: number; // 0 to 100
  target?: number;
  current?: number;
  completedAt?: any;
  notified?: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: any;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  color?: string;
}
