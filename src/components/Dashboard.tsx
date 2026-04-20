import React, { useEffect, useState, useMemo } from 'react';
import { User, Account, Transaction, Alert, Mission } from '../types';
import { db, collection, onSnapshot, query, orderBy, limit, auth, signOut, addDoc, deleteDoc, updateDoc, doc, getDoc, Timestamp, OperationType, handleStorageError, updateProfile, updateEmail, updatePassword, uploadAvatar } from '../lib/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet,
  TrendingUp, 
  TrendingDown, 
  LayoutDashboard, 
  CreditCard, 
  History, 
  Bell, 
  Trophy, 
  LogOut, 
  Plus,
  Star,
  Award,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  X,
  Menu,
  Trash2,
  Loader2,
  ChevronRight,
  MessageSquare,
  AlertCircle,
  Bot,
  Radar,
  Target,
  Settings,
  Download,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  ArrowUpDown,
  User as UserIcon,
  Shield,
  Link as LinkIcon,
  Check,
  Eye,
  EyeOff,
  StickyNote,
  Camera,
  MessageCircle
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { VorixIA } from './VorixIA';
import { AlertsView } from './AlertsView';
import { RadarView } from './RadarView';
import { GoalsView } from './GoalsView';
import { NotesView } from './NotesView';
import { MissionsView } from './MissionsView';
import { SubscriptionView } from './SubscriptionView';
import { generateProactiveAlerts } from '../lib/alerts';
import { initializeUserGamification, updateMissionProgress, checkAndUnlockBadge, checkMilestones, markMissionAsNotified } from '../services/gamificationService';
import { MissionCelebration } from './MissionCelebration';
import { Flame } from 'lucide-react';
import { updateStreakOnActivity } from '../services/streakService';
import { generatePDFReport } from '../utils/pdfGenerator';
interface DashboardProps {
  user: User;
  onSubscriptionSuccess?: (plan: 'pro' | 'premium') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onSubscriptionSuccess }) => {
  const [view, setView] = useState<'dashboard' | 'transactions' | 'accounts' | 'ia' | 'alerts' | 'radar' | 'missions' | 'goals' | 'notes' | 'settings' | 'subscription'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Transaction Filtering and Sorting State
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState('all');
  const [transactionAccountFilter, setTransactionAccountFilter] = useState('all');
  const [transactionStartDate, setTransactionStartDate] = useState('');
  const [transactionEndDate, setTransactionEndDate] = useState('');
  const [transactionSortBy, setTransactionSortBy] = useState<'date' | 'amount'>('date');
  const [transactionSortOrder, setTransactionSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search filter
    if (transactionSearch) {
      const search = transactionSearch.toLowerCase();
      result = result.filter(t => 
        t.description.toLowerCase().includes(search) || 
        t.category.toLowerCase().includes(search)
      );
    }

    // Category filter
    if (transactionCategoryFilter !== 'all') {
      result = result.filter(t => t.category === transactionCategoryFilter);
    }

    // Account filter
    if (transactionAccountFilter !== 'all') {
      result = result.filter(t => t.accountId === transactionAccountFilter);
    }

    // Date range filter
    if (transactionStartDate) {
      const start = new Date(transactionStartDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(t => {
        const tDate = new Date(t.date?.seconds * 1000);
        return tDate >= start;
      });
    }
    if (transactionEndDate) {
      const end = new Date(transactionEndDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(t => {
        const tDate = new Date(t.date?.seconds * 1000);
        return tDate <= end;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (transactionSortBy === 'date') {
        const dateA = a.date?.seconds || 0;
        const dateB = b.date?.seconds || 0;
        comparison = dateA - dateB;
      } else if (transactionSortBy === 'amount') {
        comparison = a.amount - b.amount;
      }

      return transactionSortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [transactions, transactionSearch, transactionCategoryFilter, transactionAccountFilter, transactionStartDate, transactionEndDate, transactionSortBy, transactionSortOrder]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [celebratingMission, setCelebratingMission] = useState<Mission | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  
  // Transaction Modal State
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Account Modal State
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'corrente' | 'poupanca' | 'investimento' | 'outros'>('corrente');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountInstitution, setAccountInstitution] = useState('');
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);

  // Account Details State
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{id: string, type: 'transaction' | 'account' | 'integration'} | null>(null);
  
  // Export PDF State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);
  const [editingSetting, setEditingSetting] = useState<'profile' | 'security' | 'notifications' | 'integrations' | 'whatsapp' | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [settingForm, setSettingForm] = useState({
    name: user.username || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    birthDate: user.birthDate || '',
    phone: user.phone || '',
    whatsappNumber: user.whatsappNumber || '',
    whatsappConnected: user.whatsappConnected || false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    push: true,
    email: true,
    alerts: true,
  });
  const [isSavingSetting, setIsSavingSetting] = useState(false);
  const [settingError, setSettingError] = useState<string | null>(null);
  const [settingSuccess, setSettingSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Cancellation States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const streakInfo = useMemo(() => {
    const s = user.streak || { currentStreak: 0, longestStreak: 0, lastActivityDate: '', streakUpdatedToday: false };
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isUpdatedToday = s.lastActivityDate === todayStr;
    const isLate = today.getHours() >= 18;
    const needsUpdate = !isUpdatedToday && isLate;
    
    let colorClass = 'text-zinc-500';
    let glowClass = '';
    let animate = {};

    if (s.currentStreak > 0) {
      if (s.currentStreak >= 7) {
        colorClass = 'text-orange-500';
        glowClass = 'drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]';
        animate = { scale: [1, 1.1, 1] };
      } else if (s.currentStreak >= 3) {
        colorClass = 'text-orange-500';
        animate = { scale: [1, 1.05, 1] };
      } else {
        colorClass = 'text-orange-400';
      }
    }

    if (needsUpdate) {
      colorClass = 'text-rose-500';
      animate = { scale: [1, 1.2, 1] };
    }

    return { ...s, isUpdatedToday, needsUpdate, colorClass, glowClass, animate };
  }, [user.streak]);

  const isTrialExpired = useMemo(() => {
    if (user.subscriptionStatus === 'active') return false;
    if (!user.trialEndsAt) return false;
    const end = new Date(user.trialEndsAt.seconds * 1000);
    return end < new Date();
  }, [user.trialEndsAt, user.subscriptionStatus]);

  const daysLeft = useMemo(() => {
    if (!user.trialEndsAt) return 0;
    const end = new Date(user.trialEndsAt.seconds * 1000);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [user.trialEndsAt]);

  // Reset transaction form when modal opens
  useEffect(() => {
    if (showAdd) {
      setAmount('');
      setDescription('');
      // Keep category as default or last used
      // Keep accountId if it was set by selectedAccount logic
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [showAdd]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setIsSavingSetting(true);
    setSettingError(null);
    try {
      const publicUrl = await uploadAvatar(user.uid, file);
      setSettingForm(prev => ({ ...prev, photoURL: publicUrl }));
      
      // Update DB immediately for the photo
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: publicUrl
      });
      
      setSettingSuccess('Foto atualizada com sucesso!');
      setTimeout(() => setSettingSuccess(null), 3000);
    } catch (error: any) {
      setSettingError('Erro ao fazer upload da foto: ' + error.message);
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSetting(true);
    setSettingError(null);
    setSettingSuccess(null);

    try {
      if (auth.currentUser) {
        // Update Firebase Auth Profile
        await updateProfile(auth.currentUser, {
          displayName: settingForm.name,
          photoURL: settingForm.photoURL
        });

        // Detecta se ativou o whatsapp ou trocou número com ele ativo
        const isWhatsappNewOrChanged = settingForm.whatsappConnected && 
          (!user.whatsappConnected || settingForm.whatsappNumber !== user.whatsappNumber);

        // Update Firestore User Document
        await updateDoc(doc(db, 'users', user.uid), {
          username: settingForm.name,
          photoURL: settingForm.photoURL,
          birthDate: settingForm.birthDate || null,
          phone: settingForm.phone || null,
          whatsappNumber: settingForm.whatsappNumber || null,
          whatsappConnected: settingForm.whatsappConnected,
        });

        // Dispara a mensagem de boas-vindas do whatsapp de forma silenciosa e no background
        if (isWhatsappNewOrChanged && settingForm.whatsappNumber) {
          fetch('/api/whatsapp/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: settingForm.whatsappNumber,
              username: settingForm.name,
              notificationType: 'welcome'
            })
          }).catch(e => console.warn('Falha no gatilho do WPP:', e));
        }

        // Update Email if changed
        if (settingForm.email !== user.email) {
          await updateEmail(auth.currentUser, settingForm.email);
          await updateDoc(doc(db, 'users', user.uid), {
            email: settingForm.email
          });
        }

        setSettingSuccess('Perfil atualizado com sucesso!');
        setTimeout(() => setEditingSetting(null), 2000);
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setSettingError('Para alterar o e-mail, você precisa fazer login novamente recentemente.');
      } else {
        setSettingError('Erro ao atualizar perfil: ' + error.message);
      }
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settingForm.newPassword !== settingForm.confirmPassword) {
      setSettingError('As senhas não coincidem.');
      return;
    }

    setIsSavingSetting(true);
    setSettingError(null);
    setSettingSuccess(null);

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, settingForm.newPassword);
        setSettingSuccess('Senha alterada com sucesso!');
        setSettingForm({ ...settingForm, currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setEditingSetting(null), 2000);
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setSettingError('Para alterar a senha, você precisa fazer login novamente recentemente.');
      } else {
        setSettingError('Erro ao alterar senha: ' + error.message);
      }
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleUpdateNotifications = async () => {
    setIsSavingSetting(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: notificationSettings
      });
      setSettingSuccess('Preferências de notificação salvas!');
      setTimeout(() => setSettingSuccess(null), 3000);
    } catch (error: any) {
      setSettingError('Erro ao salvar notificações: ' + error.message);
    } finally {
      setIsSavingSetting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      setCancelError('Por favor, informe um motivo.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    setCancelSuccess(null);
    try {
      const response = await fetch('/api/checkout/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          reason: cancelReason,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao cancelar assinatura');

      setCancelSuccess('Sua assinatura foi cancelada com sucesso.');
      setSettingSuccess('Assinatura cancelada com sucesso.');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setCancelError(err.message || 'Erro ao cancelar assinatura. Tente novamente.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRemoveIntegration = async (id: string) => {
    setShowDeleteConfirm({ id, type: 'integration' });
  };

  const confirmRemoveIntegration = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'accounts', id));
      setSettingSuccess('Integração removida com sucesso!');
      setTimeout(() => setSettingSuccess(null), 3000);
    } catch (error: any) {
      setSettingError('Erro ao remover integração: ' + error.message);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    const accountsQuery = query(collection(db, 'users', user.uid, 'accounts'));
    const transactionsQuery = query(collection(db, 'users', user.uid, 'transactions'), orderBy('date', 'desc'), limit(300));
    const alertsQuery = query(collection(db, 'users', user.uid, 'alerts'), orderBy('createdAt', 'desc'), limit(30));
    const missionsQuery = query(collection(db, 'users', user.uid, 'missions'), limit(50));
    const notesQuery = query(collection(db, 'users', user.uid, 'notes'));
    const goalsQuery = query(collection(db, 'users', user.uid, 'goals'));

    const unsubAccounts = onSnapshot(accountsQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/accounts`);
    });

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/transactions`);
    });

    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert)));
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/alerts`);
    });

    const unsubMissions = onSnapshot(missionsQuery, (snapshot) => {
      setMissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission)));
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/missions`);
    });

    const unsubNotes = onSnapshot(notesQuery, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/notes`);
    });

    const unsubGoals = onSnapshot(goalsQuery, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/goals`);
    });

    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Initialize gamification
    initializeUserGamification(user.uid);

    return () => {
      unsubAccounts();
      unsubTransactions();
      unsubAlerts();
      unsubMissions();
      unsubNotes();
      unsubGoals();
      window.removeEventListener('resize', checkMobile);
    };
  }, [user?.uid]);

  // Auto-generate alerts if none exist
  useEffect(() => {
    if (!user?.uid || alerts.length > 0 || transactions.length === 0 || accounts.length === 0) return;
    
    const checkAndGenerateAlerts = async () => {
      await generateProactiveAlerts(user, accounts, transactions, alerts);
    };
    checkAndGenerateAlerts();
  }, [user?.uid, alerts.length, transactions.length, accounts.length]);

  // Check milestones whenever accounts, transactions, notes or goals change
  useEffect(() => {
    if (!user?.uid || accounts.length === 0) return;
    
    // debounce check milestones context so it doesn't run excessively
    const timeoutId = setTimeout(async () => {
      await checkMilestones(user, accounts, transactions, notes, goals);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [user?.uid, accounts, transactions, notes, goals]);

  useEffect(() => {
    if (missions.length > 0) {
      const newlyCompleted = missions.find(m => m.completed && !m.notified);
      if (newlyCompleted) {
        setCelebratingMission(newlyCompleted);
        setIsCelebrationOpen(true);
      }
    }
  }, [missions]);

  const handleCloseCelebration = () => {
    if (celebratingMission) {
      markMissionAsNotified(user?.uid || '', celebratingMission.id).catch(console.error);
    }
    setIsCelebrationOpen(false);
    setCelebratingMission(null);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !description || !accountId) return;

    const numAmount = parseFloat(amount);
    setIsSubmitting(true);
    
    try {
      // 1. Salva a transação no Firestore
      await addDoc(collection(db, `users/${user.uid}/transactions`), {
        userId: user.uid,
        accountId,
        amount: numAmount,
        type: transactionType,
        category,
        description,
        date: Timestamp.fromDate(new Date(date + 'T00:00:00'))
      });

      // 1.5. Atualiza o Streak do usuário
      if (user?.uid) {
        await updateStreakOnActivity(user.uid, user.streak);
      }

      // 2. Atualiza o saldo da conta bancária correspondente
      const accountRef = doc(db, `users/${user.uid}/accounts`, accountId);
      const accountSnap = await getDoc(accountRef);
      
      if (accountSnap.exists()) {
        const currentBalance = accountSnap.data().balance || 0;
        const newBalance = transactionType === 'income'
          ? currentBalance + numAmount
          : currentBalance - numAmount;
          
        await updateDoc(accountRef, { balance: newBalance });
      }

      // Limpa o formulário e fecha o modal
      setShowAdd(false);
      setAmount('');
      setDescription('');
      setAccountId('');
      setDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      handleStorageError(error, OperationType.CREATE, `users/${user.uid}/transactions`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id: string, accountId: string, amount: number, type: 'income' | 'expense') => {
    if (!user) return;
    
    try {
      // 1. Deleta o documento da transação
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, id));

      // 2. Reverte o valor no saldo da conta
      const accountRef = doc(db, `users/${user.uid}/accounts`, accountId);
      const accountSnap = await getDoc(accountRef);
      
      if (accountSnap.exists()) {
        const currentBalance = accountSnap.data().balance || 0;
        const newBalance = type === 'income'
          ? currentBalance - amount // Se era receita e foi apagada, subtrai
          : currentBalance + amount; // Se era despesa e foi apagada, devolve o dinheiro
          
        await updateDoc(accountRef, { balance: newBalance });
      }
    } catch (error) {
      handleStorageError(error, OperationType.DELETE, `users/${user.uid}/transactions`);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !accountName || !accountBalance) return;

    const numBalance = parseFloat(accountBalance);
    setIsSubmittingAccount(true);
    
    try {
      // Account Limit Check
      const maxAccounts = user.plan === 'premium' ? Infinity : (user.plan === 'pro' ? 3 : 1);
      if (accounts.length >= maxAccounts) {
        alert(`Seu plano ${user.plan || 'Trial'} permite no máximo ${maxAccounts} ${maxAccounts === 1 ? 'conta' : 'contas'}. Faça o upgrade para adicionar mais!`);
        setIsSubmittingAccount(false);
        return;
      }

      await addDoc(collection(db, `users/${user.uid}/accounts`), {
        name: accountName,
        tipo: accountType,
        balance: numBalance,
        instituicao: accountInstitution,
        cor: '#ea580c' // Default color
      });

      setShowAddAccount(false);
      setAccountName('');
      setAccountBalance('');
      setAccountInstitution('');
    } catch (error) {
      handleStorageError(error, OperationType.CREATE, `users/${user.uid}/accounts`);
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!user) return;
    setIsDeletingAccount(true);
    try {
      await deleteDoc(doc(db, `users/${user.uid}/accounts`, id));
      setSelectedAccount(null);
      setShowDeleteConfirm(null);
    } catch (error) {
      handleStorageError(error, OperationType.DELETE, `users/${user.uid}/accounts`);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleExportPDF = async () => {
    if (!user) return;
    if (transactions.length === 0) {
      alert("Você precisa adicionar pelo menos uma transação para gerar um relatório.");
      return;
    }

    setIsExporting(true);

    // Report Limit Check
    if (user.plan !== 'premium') {
      if (user.plan === 'pro') {
        // Pro: 1 report per week
        if (user.lastReportDate) {
          const lastReport = new Date(user.lastReportDate);
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          if (lastReport > oneWeekAgo) {
            alert("O plano Pro permite 1 relatório por semana. Faça o upgrade para o Premium!");
            setIsExporting(false);
            return;
          }
        }
      } else {
        // Trial/Free: 2 reports total
        if ((user.reportsCount || 0) >= 2) {
          alert("Você atingiu o limite de 2 relatórios totais do plano de Teste. Faça o upgrade!");
          setIsExporting(false);
          return;
        }
      }
    }

    try {
      // Filter transactions by date range in local time to avoid timezone offset issues
      const start = new Date(`${exportStartDate}T00:00:00`);
      const end = new Date(`${exportEndDate}T23:59:59.999`);

      const filteredTransactions = transactions.filter(t => {
        const tTime = t.date?.seconds ? t.date.seconds * 1000 : new Date(t.date).getTime();
        if (isNaN(tTime)) return false;
        const tDate = new Date(tTime);
        return tDate >= start && tDate <= end;
      }).sort((a, b) => {
        const aTime = a.date?.seconds ? a.date.seconds * 1000 : new Date(a.date).getTime();
        const bTime = b.date?.seconds ? b.date.seconds * 1000 : new Date(b.date).getTime();
        return aTime - bTime;
      });

      const periodIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
      const periodExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
      const netChange = periodIncome - periodExpenses;

      const payload = {
        user: { username: user.username },
        transactions: filteredTransactions.map(t => {
          const account = accounts.find(a => a.id === t.accountId);
          const tTime = t.date?.seconds ? t.date.seconds * 1000 : new Date(t.date).getTime();
          return {
            description: t.description,
            category: t.category,
            type: t.type,
            accountName: account ? account.name : 'N/A',
            amountFormatted: formatCurrency(t.amount).replace('R$', '').trim(),
            dateFormatted: new Date(tTime).toLocaleDateString('pt-BR')
          };
        }),
        dateRange: `${start.toLocaleDateString('pt-BR')} até ${end.toLocaleDateString('pt-BR')}`,
        totalBalance: formatCurrency(totalBalance),
        monthlyIncome: formatCurrency(monthlyIncome),
        monthlyExpenses: formatCurrency(monthlyExpenses),
        periodIncome: formatCurrency(periodIncome),
        periodExpenses: formatCurrency(periodExpenses),
        netChange: formatCurrency(netChange)
      };

      const response = generatePDFReport(payload);
      
      // Update report tracking
      const today = new Date().toISOString().split('T')[0];
      await updateDoc(doc(db, 'users', user.uid), {
        reportsCount: (user.reportsCount || 0) + 1,
        lastReportDate: today
      });

      setShowExportModal(false);
    } catch (error: any) {
      console.error('Export error:', error);
      setSettingError('Erro ao exportar relatório: ' + error.message);
      setTimeout(() => setSettingError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const monthlyIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const monthlyExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);

  const chartData = [
    { name: 'Seg', income: 400, expense: 240 },
    { name: 'Ter', income: 300, expense: 139 },
    { name: 'Qua', income: 200, expense: 980 },
    { name: 'Qui', income: 278, expense: 390 },
    { name: 'Sex', income: 189, expense: 480 },
    { name: 'Sab', income: 239, expense: 380 },
    { name: 'Dom', income: 349, expense: 430 },
  ];

  const pieData = [
    { name: 'Alimentação', value: 400 },
    { name: 'Transporte', value: 300 },
    { name: 'Lazer', value: 300 },
    { name: 'Saúde', value: 200 },
  ];

  const COLORS = ['#ea580c', '#10b981', '#3b82f6', '#8b5cf6'];

  return (
    <div className="flex h-screen bg-black overflow-hidden relative text-white">
      {/* Trial Expired Overlay */}
      {isTrialExpired && view !== 'subscription' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] max-w-md text-center space-y-6">
            <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-2xl font-black text-white">Seu período de teste expirou!</h2>
            <p className="text-zinc-500 font-medium">Aproveite para assinar o plano Premium por apenas R$ 10,99/mês e continue evoluindo suas finanças.</p>
            <button 
              onClick={() => setView('subscription')}
              className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-orange-600/20"
            >
              Ver Planos de Assinatura
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={isMobile ? (isSidebarOpen ? 'open' : 'closed') : 'desktop'}
        variants={{
          open: { 
            x: 0,
            pointerEvents: 'auto',
            transition: { 
              type: 'spring', 
              damping: 25, 
              stiffness: 200,
              staggerChildren: 0.05,
              delayChildren: 0.1
            } 
          },
          closed: { 
            x: -256,
            pointerEvents: 'none',
            transition: { 
              type: 'spring', 
              damping: 25, 
              stiffness: 200,
              staggerDirection: -1
            } 
          },
          desktop: { 
            x: 0,
            pointerEvents: 'auto'
          }
        }}
        className="fixed lg:relative inset-y-0 left-0 w-64 border-r border-zinc-900 flex flex-col p-6 space-y-8 bg-black z-50 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#ff4d00] rounded-xl overflow-hidden shadow-lg shadow-[#ff4d00]/20">
              <img src="/favicon.png" alt="Vorix Logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tighter text-white">VORIX</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'transactions', label: 'Transações', icon: History },
            { id: 'accounts', label: 'Contas', icon: CreditCard },
            { id: 'alerts', label: 'Alertas', icon: AlertCircle },
            { id: 'radar', label: 'Radar', icon: Radar },
            { id: 'missions', label: 'Missões', icon: Trophy },
            { id: 'goals', label: 'Metas', icon: Target },
            { id: 'notes', label: 'Anotações', icon: StickyNote },
            { id: 'ia', label: 'IA Vorix', icon: MessageCircle },
            { id: 'subscription', label: 'Assinatura', icon: Star },
            { id: 'reports', label: 'Relatórios', icon: Download },
            { id: 'settings', label: 'Configurações', icon: Settings },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { 
                if (item.id === 'reports') {
                  setShowExportModal(true);
                  if (isMobile) setIsSidebarOpen(false);
                } else {
                  setView(item.id as any); 
                  if (isMobile) setIsSidebarOpen(false); 
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all group ${
                view === item.id 
                  ? 'bg-[#ff4d00] text-white shadow-lg shadow-[#ff4d00]/20' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={`w-5 h-5 ${view === item.id ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                <span>{item.label}</span>
              </div>
              {item.id === 'alerts' && alerts.filter(a => !a.read).length > 0 && (
                <span className="bg-orange-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alerts.filter(a => !a.read).length}
                </span>
              )}
              {view === item.id && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-zinc-800">
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center space-x-3 px-4 py-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto px-3 py-3 lg:p-12 space-y-5 lg:space-y-8 custom-scrollbar relative ${view === 'ia' ? 'flex flex-col pb-0' : ''}`}>
        {/* Header */}
        <header className="flex flex-col space-y-2.5 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
          {/* Top Row for Mobile: Level and PONTOS */}
          <div className="flex lg:hidden items-center justify-between px-0.5">
             <div className="flex items-center space-x-1.5">
                <div className="px-1.5 py-0.5 bg-orange-600/10 border border-orange-600/20 rounded-full">
                  <span className="text-[7px] font-bold text-orange-500 uppercase tracking-widest">
                    Nível {Math.floor((user.vorixScore || 0) / 1000) + 1}
                  </span>
                </div>
                {user.subscriptionStatus === 'trialing' && (
                  <div className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded-full flex items-center space-x-1">
                    <Clock className="w-2 h-2 text-orange-500" />
                    <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">{daysLeft}D</span>
                  </div>
                )}
                {user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial' && (
                  <div className={`px-1.5 py-0.5 rounded-full flex items-center space-x-1 border ${
                    user.plan === 'premium'
                      ? 'bg-emerald-500/20 border-emerald-500/30'
                      : 'bg-orange-500/20 border-orange-500/30'
                  }`}>
                    <Star className={`w-2 h-2 fill-current ${
                      user.plan === 'premium' ? 'text-emerald-400' : 'text-orange-400'
                    }`} />
                    <span className={`text-[7px] font-bold uppercase tracking-widest ${
                      user.plan === 'premium' ? 'text-emerald-400' : 'text-orange-400'
                    }`}>{user.plan === 'premium' ? 'PREMIUM' : 'PRO'}</span>
                  </div>
                )}
             </div>
             <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setView('missions')}
                className="flex items-center space-x-1 bg-zinc-900/50 border border-zinc-800 px-2 py-0.5 rounded-full"
             >
                <Zap className="w-2 h-2 text-[#ff4d00] fill-[#ff4d00]" />
                <span className="text-[8px] font-bold text-white uppercase tracking-wider">
                  {user.vorixScore} PONTOS
                </span>
             </motion.button>
          </div>

          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="lg:hidden">
                <p className="text-[8px] font-medium text-zinc-500 uppercase tracking-wider">Olá,</p>
                <h1 className="text-sm font-bold text-white leading-tight">{user.username}</h1>
              </div>
              <h1 className="hidden lg:block text-xl font-bold tracking-tight text-white">Dashboard</h1>
            </div>

            <div className="flex items-center space-x-2 lg:hidden">
              <button 
                onClick={() => setView('settings')}
                className="w-8 h-8 rounded-lg overflow-hidden border-2 border-zinc-800 active:scale-95 transition-all"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between lg:justify-end space-x-4 lg:space-x-6">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden lg:flex flex-col items-end"
            >
              <div className="flex items-center space-x-4">
                {user.subscriptionStatus === 'trialing' && (
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full">
                    <Clock className="w-3 h-3 text-orange-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{daysLeft} dias de teste</span>
                  </div>
                )}
                {user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial' && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    onClick={() => setView('subscription')}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all ${
                      user.plan === 'premium'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'
                    }`}
                  >
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Cliente {user.plan === 'premium' ? 'Premium' : 'Pro'} ✓
                    </span>
                  </motion.button>
                )}
                {user.subscriptionStatus === 'trialing' && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setView('subscription')}
                    className="flex items-center space-x-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-500 text-xs font-bold hover:bg-orange-500/20 transition-all"
                  >
                    <Star className="w-3.5 h-3.5 fill-orange-500" />
                    <span>Upgrade</span>
                  </motion.button>
                )}
                <div className="bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-full flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-[#ff4d00] fill-[#ff4d00]" />
                  <motion.span 
                    key={user.vorixScore}
                    initial={{ scale: 1.2, color: '#ffffff' }}
                    animate={{ scale: 1, color: '#ff4d00' }}
                    className="text-xs font-bold uppercase tracking-wider"
                  >
                    {user.vorixScore} PONTOS
                  </motion.span>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 px-4 py-2 rounded-full flex items-center space-x-2">
                  <motion.div
                    animate={streakInfo.animate}
                    transition={{ repeat: Infinity, duration: streakInfo.needsUpdate ? 1 : 3 }}
                    className={`${streakInfo.colorClass} ${streakInfo.glowClass}`}
                  >
                    <Flame className="w-4 h-4 fill-current" />
                  </motion.div>
                  <span className="text-bold text-xs uppercase tracking-wider">
                    {streakInfo.currentStreak || 0} Dias
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1 mr-2">
                Nível {Math.floor((user.vorixScore || 0) / 1000) + 1}
              </span>
            </motion.div>

            <div className="hidden lg:flex items-center space-x-4 pl-6 border-l border-zinc-800">
              <div className="text-right">
                <p className="text-sm font-bold text-white leading-none">{user.username}</p>
                <p className={`text-[10px] uppercase tracking-widest mt-1 ${user.subscriptionStatus === 'trialing' ? 'text-orange-500' : 'text-emerald-500'}`}>
                  {user.subscriptionStatus === 'trialing' ? 'Período de Teste' : 'Premium'}
                </p>
              </div>
              <button 
                onClick={() => setView('settings')}
                className="w-10 h-10 rounded-xl overflow-hidden border-2 border-zinc-800 hover:border-orange-500 transition-all"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
              </button>
            </div>

            <button 
              onClick={() => setShowAdd(true)}
              className="hidden lg:flex bg-[#ff4d00] hover:bg-[#e64500] text-white px-6 py-2.5 rounded-full text-sm font-bold items-center space-x-2 transition-all active:scale-95 shadow-lg shadow-[#ff4d00]/20"
            >
              <Plus className="w-5 h-5" />
              <span>Lançar</span>
            </button>
          </div>
        </header>

        {/* Floating Action Button for Mobile */}
        <AnimatePresence>
          {isMobile && view !== 'ia' && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAdd(true)}
              className="fixed bottom-8 right-6 w-14 h-14 bg-[#ff4d00] text-white rounded-2xl shadow-2xl shadow-[#ff4d00]/40 flex items-center justify-center z-40 lg:hidden"
            >
              <Plus className="w-8 h-8" />
            </motion.button>
          )}
        </AnimatePresence>

        {view === 'dashboard' && (
          <div className="space-y-4 lg:space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-2 lg:space-y-0">
              <div className="space-y-0.5">
                <h2 className="text-lg lg:text-4xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-zinc-500 text-[9px] lg:text-lg">Bem-vindo de volta ao seu centro de comando financeiro.</p>
              </div>
              <button 
                onClick={() => setShowExportModal(true)}
                className="flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-[9px] lg:text-xs font-bold w-full lg:w-auto"
              >
                <Download className="w-3 h-3" />
                <span>Exportar Relatório (PDF)</span>
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 lg:gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                className="bg-zinc-900/40 border border-zinc-800/50 p-3 lg:p-8 rounded-xl lg:rounded-3xl space-y-1.5 lg:space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 lg:space-y-1">
                    <span className="text-zinc-500 text-[8px] lg:text-sm font-medium">Saldo Total</span>
                    <p className="text-base lg:text-4xl font-bold tracking-tighter truncate">{formatCurrency(totalBalance)}</p>
                  </div>
                  <div className="p-1.5 lg:p-4 bg-orange-600/10 rounded-lg lg:rounded-2xl border border-orange-600/20">
                    <Wallet className="text-orange-500 w-3.5 h-3.5 lg:w-8 lg:h-8" />
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -3 }}
                className="bg-zinc-900/40 border border-zinc-800/50 p-3 lg:p-8 rounded-xl lg:rounded-3xl space-y-1.5 lg:space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 lg:space-y-1">
                    <span className="text-zinc-500 text-[8px] lg:text-sm font-medium">Entradas (Mês)</span>
                    <p className="text-base lg:text-4xl font-bold tracking-tighter truncate text-emerald-500">{formatCurrency(monthlyIncome)}</p>
                    <div className="flex items-center text-emerald-500 text-[7px] lg:text-xs font-bold mt-0.5 lg:mt-2">
                      <ArrowUp className="w-2 h-2 lg:w-2.5 lg:h-2.5 mr-1" />
                      <span>12% <span className="text-zinc-500 font-medium ml-1">vs mês anterior</span></span>
                    </div>
                  </div>
                  <div className="p-1.5 lg:p-4 bg-emerald-500/10 rounded-lg lg:rounded-2xl border border-emerald-500/20">
                    <ArrowUp className="text-emerald-500 w-3.5 h-3.5 lg:w-8 lg:h-8" />
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -3 }}
                className="bg-zinc-900/40 border border-zinc-800/50 p-3 lg:p-8 rounded-xl lg:rounded-3xl space-y-1.5 lg:space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 lg:space-y-1">
                    <span className="text-zinc-500 text-[8px] lg:text-sm font-medium">Saídas (Mês)</span>
                    <p className="text-base lg:text-4xl font-bold tracking-tighter truncate text-rose-500">{formatCurrency(monthlyExpenses)}</p>
                    <div className="flex items-center text-rose-500 text-[7px] lg:text-xs font-bold mt-0.5 lg:mt-2">
                      <ArrowDown className="w-2 h-2 lg:w-2.5 lg:h-2.5 mr-1" />
                      <span>5% <span className="text-zinc-500 font-medium ml-1">vs mês anterior</span></span>
                    </div>
                  </div>
                  <div className="p-1.5 lg:p-4 bg-blue-500/10 rounded-lg lg:rounded-2xl border border-blue-500/20">
                    <ArrowDown className="text-blue-500 w-3.5 h-3.5 lg:w-8 lg:h-8" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Streak Card Removed */}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800/50 p-4 lg:p-8 rounded-2xl lg:rounded-3xl space-y-4 lg:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 lg:space-y-1">
                    <h3 className="text-sm lg:text-xl font-bold">Fluxo de Caixa</h3>
                    <p className="text-zinc-500 text-[10px] lg:text-xs">Últimos 7 dias</p>
                  </div>
                </div>
                <div className="h-48 lg:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                      <Area type="monotone" dataKey="expense" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 lg:p-8 rounded-2xl lg:rounded-3xl space-y-4 lg:space-y-6">
                <div className="space-y-0.5 lg:space-y-1">
                  <h3 className="text-sm lg:text-xl font-bold">Distribuição de Despesas</h3>
                  <p className="text-zinc-500 text-[10px] lg:text-xs">Mês Atual</p>
                </div>
                <div className="h-48 lg:h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 50 : 70}
                        outerRadius={isMobile ? 70 : 90}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-zinc-500 text-[8px] lg:text-xs uppercase tracking-widest">Total</p>
                      <p className="text-lg lg:text-2xl font-bold tracking-tighter">{formatCurrency(monthlyExpenses)}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:gap-4">
                  {pieData.map((item, index) => (
                    <div key={item.name} className="flex items-center space-x-1.5 lg:space-x-2 text-[9px] lg:text-xs">
                      <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                      <span className="text-zinc-500 uppercase tracking-wider font-bold truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Alerts Section */}
            {alerts.filter(a => !a.read).length > 0 && (
              <div className="bg-zinc-900/40 border border-zinc-800/50 p-4 lg:p-8 rounded-2xl lg:rounded-3xl space-y-4 lg:space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 lg:space-x-3">
                    <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg lg:rounded-xl">
                      <Bell className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                    </div>
                    <h3 className="text-sm lg:text-xl font-bold">Alertas da Vorix</h3>
                  </div>
                  <button 
                    onClick={() => setView('alerts')}
                    className="text-[10px] lg:text-sm font-bold text-orange-500 hover:text-orange-400 transition-colors flex items-center space-x-1"
                  >
                    <span>Ver Tudo</span>
                    <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                  {alerts.filter(a => !a.read).slice(0, 3).map((alert) => (
                    <div 
                      key={alert.id}
                      className="bg-zinc-950 border border-zinc-800 p-4 lg:p-5 rounded-xl lg:rounded-2xl space-y-2 lg:space-y-3 hover:border-zinc-700 transition-all cursor-pointer group"
                      onClick={() => setView('alerts')}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] lg:text-[10px] font-bold uppercase tracking-wider border ${
                          alert.severity === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          alert.severity === 'medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-[8px] lg:text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                          {new Date(alert.createdAt?.seconds * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-0.5 lg:space-y-1">
                        <h4 className="font-bold text-xs lg:text-sm group-hover:text-orange-500 transition-colors truncate">{alert.title}</h4>
                        <p className="text-zinc-500 text-[10px] lg:text-xs line-clamp-2 leading-relaxed">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-3.5 lg:p-6 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
                <h3 className="font-bold text-sm lg:text-base">Transações Recentes</h3>
                <div className="flex items-center space-x-2 lg:space-x-3 w-full lg:w-auto">
                  <div className="relative flex-1 lg:flex-none">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Buscar..." 
                      className="bg-zinc-800 border-none rounded-lg lg:rounded-xl pl-9 lg:pl-10 pr-4 py-1.5 lg:py-2 text-xs lg:text-sm text-zinc-300 focus:ring-1 focus:ring-orange-600 transition-all w-full lg:w-48"
                    />
                  </div>
                  <button className="p-2 bg-zinc-800 rounded-lg lg:rounded-xl text-zinc-400 hover:text-white transition-all active:scale-95">
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setShowAdd(true)}
                    className="hidden lg:flex bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold items-center space-x-2 transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Novo</span>
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar">
                {isMobile ? (
                  <div className="divide-y divide-zinc-800">
                    {transactions.length > 0 ? transactions.slice(0, 10).map((t, index) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={t.id} 
                        className="p-4 flex items-center justify-between active:bg-zinc-800/50 transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2.5 rounded-xl ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-bold text-white text-sm leading-tight">{t.description}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                              {t.category} • {new Date(t.date?.seconds * 1000).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </p>
                          <button 
                            onClick={() => setShowDeleteConfirm({ id: t.id, type: 'transaction' })}
                            className="text-zinc-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="p-12 text-center text-zinc-500">Nenhuma transação encontrada.</div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                        <th className="px-6 py-4 font-medium">Descrição</th>
                        <th className="px-6 py-4 font-medium">Categoria</th>
                        <th className="px-6 py-4 font-medium">Conta</th>
                        <th className="px-6 py-4 font-medium">Data</th>
                        <th className="px-6 py-4 font-medium text-right">Valor</th>
                        <th className="px-6 py-4 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {transactions.length > 0 ? transactions.slice(0, 10).map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-800/50 transition-all group">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                              </div>
                              <span className="font-medium">{t.description}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-sm">{t.category}</td>
                          <td className="px-6 py-4 text-zinc-400 text-sm">
                            {accounts.find(a => a.id === t.accountId)?.name || 'Conta'}
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-sm">{new Date(t.date?.seconds * 1000).toLocaleDateString()}</td>
                          <td className={`px-6 py-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setShowDeleteConfirm({ id: t.id, type: 'transaction' })}
                              className="p-2 text-zinc-500 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                            Nenhuma transação encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'ia' && (
          <div className="flex flex-col flex-1 h-[calc(100vh-120px)] lg:h-[calc(100vh-40px)] pb-20 lg:pb-0">
            <div className="space-y-1 mb-4 lg:mb-6">
              <h2 className="text-2xl lg:text-4xl font-bold tracking-tight">IA Vorix</h2>
              <p className="text-zinc-500 text-sm lg:text-lg">Sua inteligência artificial para análise e evolução financeira.</p>
            </div>
            <VorixIA user={user} transactions={transactions} accounts={accounts} fullView={true} />
          </div>
        )}

        {view === 'subscription' && (
          <SubscriptionView user={user} onSuccess={onSubscriptionSuccess} />
        )}

        {view === 'alerts' && (
          <AlertsView 
            user={user} 
            alerts={alerts} 
            transactions={transactions} 
            accounts={accounts} 
          />
        )}

        {view === 'radar' && (
          <RadarView user={user} />
        )}

        {view === 'goals' && (
          <GoalsView user={user} />
        )}

        {view === 'missions' && (
          <MissionsView user={user} />
        )}

        {view === 'notes' && (
          <NotesView user={user} />
        )}

        {view === 'settings' && (
          <div className="space-y-4 lg:space-y-8 pb-12">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 lg:space-y-1">
                <h2 className="text-2xl lg:text-4xl font-bold tracking-tight">Configurações</h2>
                <p className="text-zinc-500 text-sm lg:text-lg">Gerencie sua conta e preferências do app.</p>
              </div>
              {editingSetting && (
                <button 
                  onClick={() => {
                    setEditingSetting(null);
                    setSettingError(null);
                    setSettingSuccess(null);
                  }}
                  className="px-3 py-1.5 lg:px-4 lg:py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs lg:text-sm font-bold transition-all flex items-center"
                >
                  <X className="w-3.5 h-3.5 mr-1.5 lg:mr-2" />
                  Cancelar
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!editingSetting ? (
                <motion.div 
                  key="main-settings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8"
                >
                  <div className="space-y-4 lg:space-y-6">
                    <h3 className="text-lg lg:text-xl font-bold flex items-center space-x-2">
                      <UserIcon className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                      <span>Preferências Gerais</span>
                    </h3>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl divide-y divide-zinc-800 overflow-hidden">
                      {[
                        { id: 'profile', label: 'Perfil', desc: 'Nome, e-mail e foto de perfil', icon: UserIcon },
                        { id: 'security', label: 'Segurança', desc: 'Senha e autenticação em duas etapas', icon: Shield },
                        { id: 'subscription', label: 'Assinatura', desc: 'Gerencie seu plano e pagamentos', icon: Star },
                        { id: 'notifications', label: 'Notificações', desc: 'Alertas push e e-mails', icon: Bell },
                        { id: 'whatsapp', label: 'WhatsApp', desc: 'Alertas de gastos e dicas financeiras', icon: MessageCircle },
                        { id: 'integrations', label: 'Integrações', desc: 'Conectar novos bancos e serviços', icon: LinkIcon },
                      ].map((item) => (
                        <button 
                          key={item.id} 
                          onClick={() => setEditingSetting(item.id as any)}
                          className="w-full flex items-center justify-between p-6 hover:bg-zinc-800/50 transition-all"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                              <item.icon className="w-6 h-6 text-zinc-400" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold">{item.label}</p>
                              <p className="text-zinc-500 text-sm">{item.desc}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="editing-settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 space-y-8"
                >
                  {settingError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center space-x-3 text-red-500 text-sm">
                      <AlertCircle className="w-5 h-5" />
                      <span>{settingError}</span>
                    </div>
                  )}
                  {settingSuccess && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center space-x-3 text-green-500 text-sm">
                      <Check className="w-5 h-5" />
                      <span>{settingSuccess}</span>
                    </div>
                  )}

                  {editingSetting === 'profile' && (
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                      <div className="flex flex-col items-center space-y-4">
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="relative group cursor-pointer"
                        >
                          <div className="w-28 h-28 bg-zinc-800 rounded-3xl overflow-hidden border-2 border-zinc-700 group-hover:border-orange-500 transition-all">
                            {settingForm.photoURL ? (
                              <img src={settingForm.photoURL} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <UserIcon className="w-12 h-12 text-zinc-600" />
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all rounded-3xl">
                            <Camera className="w-8 h-8 text-white" />
                          </div>
                          {isSavingSetting && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-3xl">
                              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                            </div>
                          )}
                        </div>
                        <p className="text-zinc-500 text-xs font-medium">Clique para alterar a foto</p>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={onFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome de Exibição</label>
                          <input 
                            type="text"
                            value={settingForm.name}
                            onChange={(e) => setSettingForm({ ...settingForm, name: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">E-mail</label>
                          <input 
                            type="email"
                            value={settingForm.email}
                            onChange={(e) => setSettingForm({ ...settingForm, email: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Data de Nascimento</label>
                          <input 
                            type="date"
                            value={settingForm.birthDate}
                            onChange={(e) => setSettingForm({ ...settingForm, birthDate: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all font-medium"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Telefone</label>
                          <input 
                            type="tel"
                            placeholder="(00) 00000-0000"
                            value={settingForm.phone}
                            onChange={(e) => setSettingForm({ ...settingForm, phone: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all font-medium"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSavingSetting}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-2xl font-bold transition-all flex items-center justify-center"
                      >
                        {isSavingSetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
                      </button>
                    </form>
                  )}

                  {editingSetting === 'security' && (
                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nova Senha</label>
                          <div className="relative">
                            <input 
                              type={showPassword ? "text" : "password"}
                              value={settingForm.newPassword}
                              onChange={(e) => setSettingForm({ ...settingForm, newPassword: e.target.value })}
                              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                          <input 
                            type={showPassword ? "text" : "password"}
                            value={settingForm.confirmPassword}
                            onChange={(e) => setSettingForm({ ...settingForm, confirmPassword: e.target.value })}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isSavingSetting}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-2xl font-bold transition-all flex items-center justify-center"
                      >
                        {isSavingSetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Atualizar Senha'}
                      </button>
                    </form>
                  )}

                  {editingSetting === 'notifications' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        {[
                          { id: 'push', label: 'Notificações Push', desc: 'Receba alertas instantâneos no navegador' },
                          { id: 'email', label: 'E-mails Semanais', desc: 'Resumo de gastos e dicas financeiras' },
                          { id: 'alerts', label: 'Alertas de Segurança', desc: 'Avisos sobre gastos atípicos ou limites' },
                        ].map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                            <div>
                              <p className="font-bold text-sm">{item.label}</p>
                              <p className="text-zinc-500 text-xs">{item.desc}</p>
                            </div>
                            <button 
                              onClick={() => setNotificationSettings({ ...notificationSettings, [item.id]: !notificationSettings[item.id as keyof typeof notificationSettings] })}
                              className={`w-12 h-6 rounded-full transition-all relative ${notificationSettings[item.id as keyof typeof notificationSettings] ? 'bg-orange-600' : 'bg-zinc-700'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationSettings[item.id as keyof typeof notificationSettings] ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button 
                        onClick={handleUpdateNotifications}
                        disabled={isSavingSetting}
                        className="w-full py-4 bg-orange-600 hover:bg-orange-500 rounded-2xl font-bold transition-all flex items-center justify-center"
                      >
                        {isSavingSetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Preferências'}
                      </button>
                    </div>
                  )}

                  {editingSetting === 'integrations' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        {accounts.length > 0 ? accounts.map((acc) => (
                          <div key={acc.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                                <CreditCard className="w-5 h-5 text-zinc-400" />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{acc.name}</p>
                                <p className="text-zinc-500 text-xs">{acc.instituicao}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemoveIntegration(acc.id)}
                              className="p-2 text-zinc-500 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )) : (
                          <p className="text-center text-zinc-500 py-8">Nenhuma conta ou integração ativa.</p>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setEditingSetting(null);
                          setShowAddAccount(true);
                        }}
                        className="w-full py-4 border-2 border-dashed border-zinc-800 hover:border-orange-500/50 rounded-2xl text-zinc-500 hover:text-orange-500 font-bold transition-all flex items-center justify-center"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Adicionar Nova Integração
                      </button>
                    </div>
                  )}

                  {editingSetting === 'subscription' && (
                    <div className="space-y-6">
                      <div className="bg-zinc-800/50 rounded-2xl border border-zinc-800 p-6 flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                          <Star className="w-8 h-8 text-orange-500" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold">
                            {user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial' ? 'Assinatura Ativa' : 'Plano Atual'}
                          </h3>
                          <p className="text-zinc-500 text-sm">
                            {user.plan === 'premium' ? 'Plano Premium' : (user.plan === 'pro' ? 'Plano Pro' : 'Nenhuma Assinatura Ativa')}
                          </p>
                        </div>
                      </div>

                      {user.subscriptionStatus === 'active' && user.plan && user.plan !== 'trial' && (
                        <div className="space-y-4">
                          {!showCancelModal ? (
                            <button 
                              onClick={() => setShowCancelModal(true)}
                              className="w-full py-4 bg-zinc-800 hover:bg-rose-950/30 border border-zinc-800 hover:border-rose-500/50 text-zinc-400 hover:text-rose-500 rounded-2xl font-bold transition-all"
                            >
                              Cancelar Assinatura
                            </button>
                          ) : (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                              <h4 className="font-bold text-rose-500 flex items-center space-x-2">
                                <AlertCircle className="w-5 h-5" />
                                <span>Confirmar Cancelamento</span>
                              </h4>
                              <p className="text-sm text-rose-400/80 leading-relaxed">
                                Poxa, que pena que você quer ir... Para podermos melhorar a experiência do Vorix, nos conte por que você está cancelando?
                              </p>
                              
                              <div className="space-y-2">
                                <textarea
                                  rows={3}
                                  placeholder="Ex: Achei o valor alto, faltam recursos específicos, etc..."
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  disabled={isCancelling}
                                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-rose-500/60 transition-all resize-none"
                                />
                              </div>

                              {cancelError && (
                                <p className="text-rose-400 text-xs font-bold">{cancelError}</p>
                              )}
                              {cancelSuccess && (
                                <p className="text-emerald-500 text-xs font-bold">{cancelSuccess}</p>
                              )}

                              <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                  onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelReason('');
                                    setCancelError(null);
                                  }}
                                  disabled={isCancelling}
                                  className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm transition-all"
                                >
                                  Voltar
                                </button>
                                <button
                                  onClick={handleCancelSubscription}
                                  disabled={isCancelling || !cancelReason.trim()}
                                  className="py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center"
                                >
                                  {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Cancelamento'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800/50">
                        <p className="text-[10px] text-zinc-500 text-center leading-relaxed">
                          O acesso premium continuará disponível até o fim do período já pago. Cancelamento feito a qualquer momento sem multa.
                        </p>
                      </div>
                    </div>
                  )}

                  {editingSetting === 'whatsapp' && (
                    <div className="space-y-8">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
                          <MessageCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold">Conectar WhatsApp</h3>
                          <p className="text-zinc-500 text-sm max-w-xs">Receba dicas financeiras automáticas e alertas de gastos direto no seu celular.</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Número do WhatsApp</label>
                          <div className="flex space-x-2">
                            <input 
                              type="tel"
                              placeholder="+55 (11) 99999-9999"
                              value={settingForm.whatsappNumber}
                              onChange={(e) => setSettingForm({ ...settingForm, whatsappNumber: e.target.value })}
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <div className="p-4 bg-zinc-800/50 rounded-2xl border border-zinc-800 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="font-bold text-sm">Ativar Notificações</p>
                            <p className="text-zinc-500 text-xs">Receber dicas e alertas de gastos</p>
                          </div>
                          <button 
                            onClick={() => setSettingForm({ ...settingForm, whatsappConnected: !settingForm.whatsappConnected })}
                            className={`w-12 h-6 rounded-full transition-all relative ${settingForm.whatsappConnected ? 'bg-green-600' : 'bg-zinc-700'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settingForm.whatsappConnected ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>

                        <button 
                          onClick={handleUpdateProfile}
                          disabled={isSavingSetting}
                          className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-2xl font-bold transition-all flex items-center justify-center"
                        >
                          {isSavingSetting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Configurações'}
                        </button>

                        <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                          <p className="text-[10px] text-blue-400 text-center leading-relaxed">
                            Ao ativar, você concorda em receber mensagens automáticas da Vorix IA. 
                            Você poderá desativar este serviço a qualquer momento.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {view === 'accounts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
            {accounts.map((acc, index) => (
              <motion.div
                key={acc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedAccount(acc)}
                className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl lg:rounded-3xl space-y-4 lg:space-y-6 relative group overflow-hidden cursor-pointer hover:border-orange-600/50 transition-all active:scale-[0.98]"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-orange-600/10 transition-all" />
                
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center space-x-3 lg:space-x-4">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-zinc-800 rounded-xl lg:rounded-2xl flex items-center justify-center border border-zinc-700">
                      <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base lg:text-lg leading-tight">{acc.name}</h3>
                      <p className="text-zinc-500 text-[9px] lg:text-[10px] uppercase tracking-widest font-bold mt-0.5">{acc.instituicao || 'Instituição'}</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-zinc-800 rounded-full text-[8px] lg:text-[9px] font-bold uppercase tracking-widest text-zinc-400 border border-zinc-700">
                    {acc.tipo}
                  </div>
                </div>

                <div className="space-y-0.5 lg:space-y-1 relative">
                  <p className="text-zinc-500 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider">Saldo Disponível</p>
                  <p className="text-xl lg:text-3xl font-bold tracking-tighter">{formatCurrency(acc.balance)}</p>
                </div>

                <div className="pt-3 lg:pt-4 border-t border-zinc-800 flex items-center justify-between relative">
                  <div className="flex -space-x-1.5 lg:-space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-5 h-5 lg:w-6 lg:h-6 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full bg-zinc-700" />
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedAccount(acc); }}
                    className="text-[10px] lg:text-xs font-bold text-orange-500 hover:text-orange-400 transition-colors flex items-center"
                  >
                    <span>Detalhes</span>
                    <ChevronRight className="w-3.5 h-3.5 lg:w-4 lg:h-4 ml-1" />
                  </button>
                </div>
              </motion.div>
            ))}
            
            <button 
              onClick={() => setShowAddAccount(true)}
              className="border-2 border-dashed border-zinc-800 rounded-2xl lg:rounded-3xl p-4 lg:p-6 flex flex-col items-center justify-center space-y-3 lg:space-y-4 hover:border-orange-600/50 hover:bg-orange-600/5 transition-all group min-h-[160px] lg:min-h-[200px]"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-zinc-900 rounded-xl lg:rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all border border-zinc-800">
                <Plus className="w-5 h-5 lg:w-6 lg:h-6 text-zinc-500 group-hover:text-orange-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm lg:text-base text-zinc-400 group-hover:text-white transition-colors">Adicionar Conta</p>
                <p className="text-[9px] lg:text-[10px] text-zinc-600 uppercase tracking-wider font-bold mt-0.5">Conecte um novo banco</p>
              </div>
            </button>
          </div>
        )}

        {view === 'transactions' && (
          <div className="space-y-4 lg:space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl lg:rounded-3xl overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-zinc-800 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <h3 className="font-bold text-lg lg:text-xl">Histórico de Transações</h3>
                  <div className="flex items-center space-x-2 lg:space-x-3">
                    <div className="relative flex-1 lg:flex-none">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Buscar descrição ou categoria..." 
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                        className="bg-zinc-800 border-none rounded-xl pl-10 pr-4 py-2.5 text-xs lg:text-sm text-zinc-300 focus:ring-1 focus:ring-orange-600 transition-all w-full lg:w-64"
                      />
                    </div>
                    <button 
                      onClick={() => setShowFilters(!showFilters)}
                      className={`p-2.5 rounded-xl transition-all active:scale-95 flex items-center space-x-2 px-4 ${showFilters ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                    >
                      <Filter className="w-4 h-4" />
                      <span className="hidden lg:inline text-sm font-bold">Filtros</span>
                    </button>
                    <button 
                      onClick={() => setShowAdd(true)}
                      className="hidden lg:flex bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold items-center space-x-2 transition-all active:scale-95 shadow-lg shadow-orange-600/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nova</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-zinc-800/50">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Categoria</label>
                          <select 
                            value={transactionCategoryFilter}
                            onChange={(e) => setTransactionCategoryFilter(e.target.value)}
                            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-orange-600 transition-all"
                          >
                            <option value="all">Todas as Categorias</option>
                            <option>Alimentação</option>
                            <option>Transporte</option>
                            <option>Lazer</option>
                            <option>Saúde</option>
                            <option>Educação</option>
                            <option>Moradia</option>
                            <option>Salário</option>
                            <option>Investimento</option>
                            <option>Outros</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Conta</label>
                          <select 
                            value={transactionAccountFilter}
                            onChange={(e) => setTransactionAccountFilter(e.target.value)}
                            className="w-full bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-orange-600 transition-all"
                          >
                            <option value="all">Todas as Contas</option>
                            {accounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Período</label>
                          <div className="flex items-center space-x-2">
                            <input 
                              type="date" 
                              value={transactionStartDate}
                              onChange={(e) => setTransactionStartDate(e.target.value)}
                              className="flex-1 bg-zinc-800 border-none rounded-xl px-3 py-2.5 text-[10px] text-white focus:ring-1 focus:ring-orange-600 transition-all"
                            />
                            <span className="text-zinc-600">à</span>
                            <input 
                              type="date" 
                              value={transactionEndDate}
                              onChange={(e) => setTransactionEndDate(e.target.value)}
                              className="flex-1 bg-zinc-800 border-none rounded-xl px-3 py-2.5 text-[10px] text-white focus:ring-1 focus:ring-orange-600 transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Ordenar por</label>
                          <div className="flex items-center space-x-2">
                            <select 
                              value={transactionSortBy}
                              onChange={(e) => setTransactionSortBy(e.target.value as any)}
                              className="flex-1 bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-orange-600 transition-all"
                            >
                              <option value="date">Data</option>
                              <option value="amount">Valor</option>
                            </select>
                            <button 
                              onClick={() => setTransactionSortOrder(transactionSortOrder === 'asc' ? 'desc' : 'asc')}
                              className="p-2.5 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all"
                            >
                              <ArrowUpDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 flex justify-end">
                        <button 
                          onClick={() => {
                            setTransactionSearch('');
                            setTransactionCategoryFilter('all');
                            setTransactionAccountFilter('all');
                            setTransactionStartDate('');
                            setTransactionEndDate('');
                            setTransactionSortBy('date');
                            setTransactionSortOrder('desc');
                          }}
                          className="text-xs font-bold text-zinc-500 hover:text-orange-500 transition-all uppercase tracking-widest"
                        >
                          Limpar Filtros
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                {isMobile ? (
                  <div className="divide-y divide-zinc-800">
                    {filteredTransactions.length > 0 ? filteredTransactions.map((t, index) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                        key={t.id} 
                        className="p-4 flex items-center justify-between active:bg-zinc-800/50 transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2.5 rounded-xl ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-white text-sm leading-tight">{t.description}</p>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                              {t.category} • {new Date(t.date?.seconds * 1000).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className={`font-bold text-sm ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </p>
                          <button 
                            onClick={() => setShowDeleteConfirm({ id: t.id, type: 'transaction' })}
                            className="text-zinc-600 p-1 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Search className="w-8 h-8 text-zinc-600" />
                        </div>
                        <p className="text-zinc-500 font-medium">Nenhuma transação encontrada com esses filtros.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-800">
                        <th className="px-6 py-4 font-bold">Descrição</th>
                        <th className="px-6 py-4 font-bold">Categoria</th>
                        <th className="px-6 py-4 font-bold">Conta</th>
                        <th className="px-6 py-4 font-bold">Data</th>
                        <th className="px-6 py-4 font-bold text-right">Valor</th>
                        <th className="px-6 py-4 font-bold text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredTransactions.length > 0 ? filteredTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-800/50 transition-all group">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2.5 rounded-xl ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                              </div>
                              <span className="font-bold text-zinc-200">{t.description}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-zinc-700/50">
                              {t.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-sm font-medium">
                            {accounts.find(a => a.id === t.accountId)?.name || 'Conta'}
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-sm font-medium">
                            {new Date(t.date?.seconds * 1000).toLocaleDateString()}
                          </td>
                          <td className={`px-6 py-4 text-right font-mono font-bold text-base ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setShowDeleteConfirm({ id: t.id, type: 'transaction' })}
                              className="p-2 text-zinc-500 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Search className="w-8 h-8 text-zinc-600" />
                            </div>
                            <p className="text-zinc-500 font-medium">Nenhuma transação encontrada com esses filtros.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'missions' && (
          <div className="space-y-8 lg:space-y-12">
            {/* Missions Section */}
            <div className="space-y-4 lg:space-y-6">
              <div className="flex items-center space-x-2.5 lg:space-x-3">
                <div className="p-1.5 lg:p-2 bg-orange-600/10 rounded-lg lg:rounded-xl">
                  <Zap className="w-4 h-4 lg:w-5 lg:h-5 text-orange-500" />
                </div>
                <h3 className="text-xl lg:text-2xl font-bold">Missões Ativas</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {missions.filter(m => m.type !== 'achievement').length > 0 ? missions.filter(m => m.type !== 'achievement').map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-zinc-900 border border-zinc-800 p-4 lg:p-6 rounded-2xl space-y-3 lg:space-y-4 relative overflow-hidden group"
                  >
                    <div className={`absolute top-0 right-0 w-24 h-24 opacity-5 rounded-full -mr-12 -mt-12 transition-all group-hover:opacity-10 ${m.completed ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                    
                    <div className="flex items-center justify-between relative">
                      <div className={`p-2.5 lg:p-3 rounded-xl ${m.completed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        <Zap className="w-5 h-5 lg:w-6 lg:h-6" />
                      </div>
                      <div className="flex items-center space-x-1 text-orange-500 font-bold text-xs lg:text-sm">
                        <Plus className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                        <span>{m.reward} PONTOS</span>
                      </div>
                    </div>

                    <div className="space-y-1 relative">
                      <h3 className="font-bold text-base lg:text-lg">{m.title}</h3>
                      <p className="text-zinc-500 text-xs lg:text-sm leading-relaxed">{m.description}</p>
                    </div>

                    <div className="space-y-1.5 lg:space-y-2 relative">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        <span>Progresso</span>
                        <span>{m.completed ? '100%' : '0%'}</span>
                      </div>
                      <div className="h-1.5 lg:h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: m.completed ? '100%' : '0%' }}
                          className={`h-full rounded-full ${m.completed ? 'bg-emerald-500' : 'bg-orange-600'}`}
                        />
                      </div>
                    </div>

                    <button 
                      disabled={m.completed}
                      className={`w-full py-2.5 lg:py-3 rounded-xl font-bold text-xs lg:text-sm transition-all relative ${m.completed ? 'bg-emerald-500/10 text-emerald-500 cursor-default' : 'bg-zinc-800 text-white hover:bg-zinc-700 active:scale-[0.98]'}`}
                    >
                      {m.completed ? 'Missão Concluída' : 'Começar Missão'}
                    </button>
                  </motion.div>
                )) : (
                  <div className="col-span-full py-8 lg:py-12 text-center border-2 border-dashed border-zinc-800 rounded-2xl lg:rounded-3xl">
                    <p className="text-zinc-500 text-sm font-medium">Nenhuma missão ativa no momento.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Achievements Section (Trophy Room) */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-500/10 rounded-xl">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                </div>
                <h3 className="text-2xl font-bold">Galeria de Troféus</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {missions.filter(m => m.type === 'achievement').length > 0 ? missions.filter(m => m.type === 'achievement').map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-yellow-500/20 p-6 rounded-3xl space-y-4 relative overflow-hidden group text-center"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-all" />
                    
                    <div className="relative mx-auto w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20 group-hover:scale-110 transition-all">
                      <Trophy className="w-10 h-10 text-yellow-500" />
                      <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black p-1 rounded-full border-2 border-zinc-900">
                        <Star className="w-3 h-3 fill-current" />
                      </div>
                    </div>

                    <div className="space-y-1 relative">
                      <h3 className="font-bold text-yellow-500">{m.title.replace('Conquistador: ', '')}</h3>
                      <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">{m.description}</p>
                    </div>

                    <div className="pt-2 flex flex-col items-center space-y-2">
                      <div className="inline-flex items-center space-x-1 px-3 py-1 bg-yellow-500/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-yellow-500 border border-yellow-500/20">
                        <Award className="w-3 h-3" />
                        <span>Mestre Vorix</span>
                      </div>
                      {m.reward && (
                        <div className="text-[10px] font-bold text-yellow-500/60 uppercase tracking-widest">
                          +{m.reward} PONTOS
                        </div>
                      )}
                    </div>
                  </motion.div>
                )) : (
                  <div className="col-span-full py-20 text-center space-y-4 bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-[40px]">
                    <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                      <Trophy className="w-10 h-10 text-zinc-700" />
                    </div>
                    <div className="max-w-xs mx-auto">
                      <p className="text-zinc-400 font-bold text-lg">Sua galeria está vazia</p>
                      <p className="text-zinc-600 text-sm">Conclua suas metas financeiras para ganhar troféus e medalhas exclusivas!</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


      </main>

      {/* Vorix IA Chat (Floating Bubble) - REMOVED */}

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 flex-shrink-0">
                <h2 className="text-xl font-bold">Nova Transação</h2>
                <button 
                  onClick={() => setShowAdd(false)}
                  className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <div className="flex p-1 bg-zinc-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTransactionType('expense')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('income')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Receita
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all font-bold text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Descrição</label>
                  <input 
                    type="text" 
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Aluguel, Salário..."
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Categoria</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all text-sm"
                    >
                      <option>Alimentação</option>
                      <option>Transporte</option>
                      <option>Lazer</option>
                      <option>Saúde</option>
                      <option>Educação</option>
                      <option>Moradia</option>
                      <option>Salário</option>
                      <option>Investimento</option>
                      <option>Outros</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Data</label>
                    </div>
                    <input 
                      type="date" 
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Conta</label>
                  <select 
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all text-sm"
                  >
                    <option value="">Selecione uma conta</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span>Salvar Transação</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Account Modal */}
      <AnimatePresence>
        {showAddAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddAccount(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 flex-shrink-0">
                <h2 className="text-xl font-bold">Nova Conta</h2>
                <button 
                  onClick={() => setShowAddAccount(false)}
                  className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddAccount} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nome da Conta</label>
                  <input 
                    type="text" 
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Ex: Nubank, Carteira..."
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Instituição</label>
                  <input 
                    type="text" 
                    value={accountInstitution}
                    onChange={(e) => setAccountInstitution(e.target.value)}
                    placeholder="Ex: Banco do Brasil"
                    className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tipo</label>
                    <select 
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as any)}
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all text-sm"
                    >
                      <option value="corrente">Corrente</option>
                      <option value="poupanca">Poupança</option>
                      <option value="investimento">Investimento</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Saldo Inicial</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={accountBalance}
                      onChange={(e) => setAccountBalance(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-600 transition-all font-bold"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmittingAccount}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-600/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {isSubmittingAccount ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span>Criar Conta</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Account Details Modal */}
      <AnimatePresence>
        {selectedAccount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAccount(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.95, opacity: 0, x: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center border"
                    style={{ 
                      backgroundColor: `${selectedAccount.cor}10`, 
                      borderColor: `${selectedAccount.cor}30` 
                    }}
                  >
                    <CreditCard className="w-6 h-6" style={{ color: selectedAccount.cor }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedAccount.name}</h2>
                    <div className="flex items-center space-x-2">
                      <p className="text-zinc-500 text-sm">{selectedAccount.instituicao}</p>
                      <span className="text-zinc-700">•</span>
                      <p className="text-zinc-500 text-sm capitalize">{selectedAccount.tipo}</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedAccount(null);
                    setAccountSearch('');
                    setAccountTypeFilter('all');
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Account Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Saldo Atual</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{formatCurrency(selectedAccount.balance)}</p>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Entradas (Total)</p>
                    <p className="text-2xl font-bold text-emerald-500 tracking-tight">
                      {formatCurrency(transactions.filter(t => t.accountId === selectedAccount.id && t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0))}
                    </p>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Saídas (Total)</p>
                    <p className="text-2xl font-bold text-rose-500 tracking-tight">
                      {formatCurrency(transactions.filter(t => t.accountId === selectedAccount.id && t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0))}
                    </p>
                  </div>
                </div>

                {/* Account Transactions */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-lg">Movimentações</h3>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                        <button 
                          onClick={() => setAccountTypeFilter('all')}
                          className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${accountTypeFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Tudo
                        </button>
                        <button 
                          onClick={() => setAccountTypeFilter('income')}
                          className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${accountTypeFilter === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Entradas
                        </button>
                        <button 
                          onClick={() => setAccountTypeFilter('expense')}
                          className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${accountTypeFilter === 'expense' ? 'bg-rose-500/10 text-rose-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Saídas
                        </button>
                      </div>
                      <div className="relative flex-1 md:flex-none">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input 
                          type="text" 
                          placeholder="Buscar..." 
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-300 focus:ring-1 focus:ring-orange-600 transition-all w-full md:w-40"
                        />
                      </div>
                      <div className="text-xs text-zinc-500 font-medium uppercase tracking-widest whitespace-nowrap">
                        {transactions.filter(t => t.accountId === selectedAccount.id).length} Transações
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {transactions
                      .filter(t => t.accountId === selectedAccount.id && 
                        (accountTypeFilter === 'all' || t.type === accountTypeFilter) &&
                        (t.description.toLowerCase().includes(accountSearch.toLowerCase()) || t.category.toLowerCase().includes(accountSearch.toLowerCase())))
                      .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
                      .length > 0 ? (
                      transactions
                        .filter(t => t.accountId === selectedAccount.id && 
                          (accountTypeFilter === 'all' || t.type === accountTypeFilter) &&
                          (t.description.toLowerCase().includes(accountSearch.toLowerCase()) || t.category.toLowerCase().includes(accountSearch.toLowerCase())))
                        .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
                        .map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:bg-zinc-900 transition-all group">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {t.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{t.description}</p>
                              <div className="flex items-center space-x-2 text-xs text-zinc-500">
                                <span>{t.category}</span>
                                <span>•</span>
                                <span>{new Date(t.date?.seconds * 1000).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <p className={`font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                            </p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm({ id: t.id, type: 'transaction' });
                              }}
                              className="p-2 text-zinc-500 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                        <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-500 text-sm">Nenhuma movimentação nesta conta.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <button 
                  onClick={() => setShowDeleteConfirm({ id: selectedAccount.id, type: 'account' })}
                  className="px-4 py-2 text-rose-500 hover:bg-rose-500/10 rounded-xl font-bold text-sm transition-all"
                >
                  Excluir Conta
                </button>
                <button 
                  onClick={() => {
                    setAccountId(selectedAccount.id);
                    setShowAdd(true);
                    setSelectedAccount(null);
                  }}
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Transação</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 lg:p-8 rounded-2xl lg:rounded-3xl shadow-2xl text-center space-y-4 lg:space-y-6"
            >
              <div className="w-14 h-14 lg:w-20 lg:h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                <Trash2 className="w-7 h-7 lg:w-10 lg:h-10 text-rose-500" />
              </div>
              <div className="space-y-1 lg:space-y-2">
                <h3 className="text-lg lg:text-xl font-bold">Confirmar Exclusão</h3>
                <p className="text-zinc-500 text-[10px] lg:text-sm">
                  {showDeleteConfirm.type === 'account' 
                    ? 'Tem certeza que deseja excluir esta conta? Todas as transações vinculadas serão mantidas, mas a conta deixará de existir.'
                    : showDeleteConfirm.type === 'integration'
                    ? 'Tem certeza que deseja remover esta integração? Todos os dados vinculados serão perdidos.'
                    : 'Tem certeza que deseja excluir esta transação?'}
                </p>
              </div>
              <div className="flex flex-col space-y-2 lg:space-y-3">
                <button 
                  onClick={() => {
                    if (showDeleteConfirm.type === 'account') {
                      handleDeleteAccount(showDeleteConfirm.id);
                    } else if (showDeleteConfirm.type === 'integration') {
                      confirmRemoveIntegration(showDeleteConfirm.id);
                    } else {
                      const t = transactions.find(tr => tr.id === showDeleteConfirm.id);
                      if (t) {
                        handleDeleteTransaction(t.id, t.accountId, t.amount, t.type);
                        setShowDeleteConfirm(null);
                      }
                    }
                  }}
                  disabled={isDeletingAccount}
                  className="w-full py-3 lg:py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl lg:rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center space-x-2 text-xs lg:text-base"
                >
                  {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Excluir Permanentemente</span>}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full py-3 lg:py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl lg:rounded-2xl font-bold transition-all active:scale-95 text-xs lg:text-base"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Export PDF Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 lg:p-8 rounded-2xl lg:rounded-3xl shadow-2xl space-y-6 lg:space-y-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 lg:space-x-4">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-orange-600/10 rounded-xl lg:rounded-2xl flex items-center justify-center border border-orange-600/20">
                    <Download className="w-5 h-5 lg:w-6 lg:h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg lg:text-xl font-bold">Exportar Relatório</h3>
                    <p className="text-zinc-500 text-[10px] lg:text-sm">Escolha o período desejado</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 lg:p-2 hover:bg-zinc-800 rounded-lg lg:rounded-xl text-zinc-400 transition-all"
                >
                  <X className="w-4 h-4 lg:w-5 lg:h-5" />
                </button>
              </div>

              <div className="space-y-4 lg:space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:gap-4">
                  <div className="space-y-1.5 lg:space-y-2">
                    <label className="text-[9px] lg:text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Data Inicial</label>
                    <input 
                      type="date" 
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl lg:rounded-2xl px-3 py-3 lg:px-4 lg:py-4 text-xs lg:text-base text-white focus:ring-2 focus:ring-orange-600 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1.5 lg:space-y-2">
                    <label className="text-[9px] lg:text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Data Final</label>
                    <input 
                      type="date" 
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl lg:rounded-2xl px-3 py-3 lg:px-4 lg:py-4 text-xs lg:text-base text-white focus:ring-2 focus:ring-orange-600 transition-all outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 lg:space-x-3">
                  <button 
                    onClick={() => {
                      const now = new Date();
                      setExportStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                      setExportEndDate(now.toISOString().split('T')[0]);
                    }}
                    className="flex-1 py-2.5 lg:py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold transition-all"
                  >
                    Mês Atual
                  </button>
                  <button 
                    onClick={() => {
                      const now = new Date();
                      setExportStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]);
                      setExportEndDate(now.toISOString().split('T')[0]);
                    }}
                    className="flex-1 py-2.5 lg:py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold transition-all"
                  >
                    Ano Atual
                  </button>
                </div>
              </div>

              <div className="pt-2 lg:pt-4">
                <button 
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="w-full py-4 lg:py-5 bg-[#ff4d00] hover:bg-[#e64500] text-white rounded-xl lg:rounded-2xl text-sm lg:text-base font-bold transition-all active:scale-95 flex items-center justify-center space-x-2 lg:space-x-3 shadow-lg shadow-[#ff4d00]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-5 h-5 lg:w-6 lg:h-6 animate-spin" />
                      <span>Gerando Relatório...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 lg:w-6 lg:h-6" />
                      <span>Gerar PDF Profissional</span>
                    </>
                  )}
                </button>
                <p className="text-center text-zinc-600 text-[8px] lg:text-[10px] mt-3 lg:mt-4 uppercase tracking-[0.2em] font-medium">
                  Relatório com validade fiscal e identidade Vorix
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCelebrationOpen && celebratingMission && (
          <MissionCelebration 
            mission={celebratingMission} 
            onClose={handleCloseCelebration} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
