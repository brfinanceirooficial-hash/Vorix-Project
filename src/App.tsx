import React, { useEffect, useState } from 'react';
import { auth, db, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, onSnapshot } from './lib/storage';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { User } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Dessert, Loader2 } from 'lucide-react';
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          };
          await setDoc(userDocRef, newUser);
        }

        // Listen for real-time updates to the user document
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
            <Dashboard user={user} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
