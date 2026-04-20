import React, { useEffect, useState } from 'react';
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, onSnapshot } from './lib/storage';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { PremiumWelcomeModal } from './components/PremiumWelcomeModal';
import { OnboardingModal } from './components/OnboardingModal';
import { User } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Dessert, Loader2 } from 'lucide-react';
import { checkUserInactivity, updateStreakOnActivity } from './services/streakService';
import confetti from 'canvas-confetti';
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcomeModal, setWelcomeModal] = useState<{ isOpen: boolean; plan: 'pro' | 'premium' }>({
    isOpen: false,
    plan: 'pro'
  });

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);

        // Check if user exists, if not create it
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          const newUser: User = {
            uid: authUser.uid,
            username: authUser.displayName || 'Usuário',
            email: authUser.email || '',
            vorixScore: 500,
            isPaid: false,
            fixedSalaryAmount: 0,
            fixedSalaryDay: 1,
            createdAt: new Date(),
            trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
            subscriptionStatus: 'trialing',
            aiRequestsCount: 0,
            lastAiRequestDate: new Date().toISOString().split('T')[0],
            onboardingCompleted: false,
          };
          await setDoc(userDocRef, newUser);
        }

        // Listen for real-time updates to the user document
        let hasCheckedStreak = false;
        unsubscribeUser = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            
            if (!userData.uid) {
              userData.uid = (userData as any).id || docSnap.id;
            }

            // Migration: Set trial for existing users who don't have it
            if (!userData.trialEndsAt) {
              const createdAtMs = userData.createdAt instanceof Date
                ? userData.createdAt.getTime()
                : (userData.createdAt as any)?.seconds
                  ? (userData.createdAt as any).seconds * 1000
                  : Date.now();
              const trialEndsAt = new Date(createdAtMs);
              trialEndsAt.setDate(trialEndsAt.getDate() + 30);

              await updateDoc(userDocRef, {
                trialEndsAt: trialEndsAt,
                subscriptionStatus: userData.isPaid ? 'active' : 'trialing'
              });
              return; // onSnapshot will trigger again
            }

            setUser(userData);
            
            // Verificação de streak: Apenas uma vez por sessão de componente
            if (userData.uid && !hasCheckedStreak) {
              hasCheckedStreak = true;
              // 1. Atualiza o streak por "check-in" (abrir o app)
              updateStreakOnActivity(userData.uid, userData.streak);
              // 2. Verifica se houve inatividade longa para resetar ou alertar
              checkUserInactivity(userData);
            }
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // Efeito de Confete e Sucesso de Assinatura
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const plan = params.get('plan');

    if (status === 'success') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff4d00', '#ffffff', '#000000']
      });

      if (plan === 'pro' || plan === 'premium') {
        setWelcomeModal({ isOpen: true, plan: plan as 'pro' | 'premium' });
      }
      
      // Limpar a URL para não disparar de novo no refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        onboardingCompleted: true
      });
    } catch (error) {
      console.error('Erro ao completar onboarding:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="text-orange-600 w-12 h-12" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-orange-600/30">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Auth />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Dashboard 
              user={user} 
              onSubscriptionSuccess={(plan) => setWelcomeModal({ isOpen: true, plan })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {welcomeModal.isOpen && user && (
          <PremiumWelcomeModal 
            user={user} 
            plan={welcomeModal.plan} 
            onClose={() => setWelcomeModal({ ...welcomeModal, isOpen: false })} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {user && user.onboardingCompleted === false && (
          <OnboardingModal 
            user={user} 
            onComplete={handleCompleteOnboarding} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
