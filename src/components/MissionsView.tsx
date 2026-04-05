import React, { useState, useEffect } from 'react';
import { User, Mission, Badge } from '../types';
import { db, collection, onSnapshot, query, orderBy, limit, doc, updateDoc, Timestamp, OperationType, handleStorageError, getDocs } from '../lib/storage';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Target, 
  Award, 
  Zap, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  Star, 
  Users, 
  TrendingUp,
  Medal,
  Crown,
  Flame
} from 'lucide-react';

interface MissionsViewProps {
  user: User;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'missions' | 'achievements' | 'badges' | 'leaderboard'>('missions');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to missions
    const missionsQuery = query(
      collection(db, `users/${user.uid}/missions`),
      orderBy('completed', 'asc'),
      orderBy('reward', 'desc')
    );

    const unsubscribeMissions = onSnapshot(missionsQuery, (snapshot) => {
      const missionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Mission[];
      setMissions(missionsData);
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/missions`);
    });

    // Listen to badges
    const badgesQuery = query(
      collection(db, `users/${user.uid}/badges`),
      orderBy('unlockedAt', 'desc')
    );

    const unsubscribeBadges = onSnapshot(badgesQuery, (snapshot) => {
      const badgesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Badge[];
      setBadges(badgesData);
    }, (error) => {
      handleStorageError(error, OperationType.GET, `users/${user.uid}/badges`);
    });

    // Fetch leaderboard (top 10 users)
    const leaderboardQuery = query(
      collection(db, 'users'),
      orderBy('vorixScore', 'desc'),
      limit(10)
    );

    const unsubscribeLeaderboard = onSnapshot(leaderboardQuery, (snapshot) => {
      const leaderboardData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as any[];
      setLeaderboard(leaderboardData as User[]);
      setLoading(false);
    }, (error) => {
      handleStorageError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubscribeMissions();
      unsubscribeBadges();
      unsubscribeLeaderboard();
    };
  }, [user.uid]);

  const filteredMissions = missions.filter(m => m.type === 'mission');
  const filteredAchievements = missions.filter(m => m.type === 'achievement');

  const renderMissions = (items: Mission[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
      <AnimatePresence mode="popLayout">
        {items.map((mission, index) => (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
            key={mission.id}
            className={`group relative p-6 lg:p-8 rounded-3xl border border-zinc-800/50 transition-all flex flex-col space-y-4 ${mission.completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/40 hover:border-zinc-700'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center text-2xl lg:text-3xl shadow-2xl ${mission.completed ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                  {mission.icon || '🎯'}
                </div>
                <div className="space-y-1">
                  <h3 className={`text-base lg:text-xl font-black tracking-tight ${mission.completed ? 'text-emerald-500' : 'text-white'}`}>
                    {mission.title}
                  </h3>
                  <p className="text-zinc-500 text-xs lg:text-sm font-medium line-clamp-1">
                    {mission.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <div className="flex items-center space-x-1.5 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <Zap className="w-3 h-3 text-orange-500 fill-orange-500" />
                  <span className="text-[10px] font-black text-orange-500">+{mission.reward} PONTOS</span>
                </div>
                {mission.completed && (
                  <div className="flex items-center space-x-1 text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Concluído</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {!mission.completed && mission.target && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  <span>Progresso</span>
                  <span>{mission.current || 0} / {mission.target}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((mission.current || 0) / mission.target) * 100}%` }}
                    className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                  />
                </div>
              </div>
            )}

            {/* Decorative background glow */}
            <div className={`absolute -right-10 -bottom-10 w-32 h-32 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${mission.completed ? 'bg-emerald-500/10' : 'bg-orange-500/5'}`} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-6 lg:space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 lg:gap-8">
        <div className="space-y-1.5 lg:space-y-4">
          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 lg:px-3 lg:py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <Trophy className="w-2.5 h-2.5 lg:w-4 lg:h-4 text-orange-500" />
            <span className="text-[8px] lg:text-xs font-bold text-orange-500 uppercase tracking-widest">Gamificação Vorix</span>
          </div>
          <h2 className="text-2xl lg:text-5xl font-black tracking-tight text-white leading-tight">Conquistas & Missões</h2>
          <p className="text-zinc-500 text-[10px] lg:text-lg max-w-2xl font-medium leading-relaxed">
            Evolua sua vida financeira completando desafios e desbloqueando recompensas exclusivas.
          </p>
        </div>

        {/* User Stats Summary */}
        <div className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 p-4 lg:p-6 rounded-3xl">
          <div className="flex flex-col items-center px-4 border-r border-zinc-800">
            <span className="text-[8px] lg:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Nível</span>
            <span className="text-xl lg:text-3xl font-black text-white">{Math.floor((user.vorixScore || 0) / 1000) + 1}</span>
          </div>
          <div className="flex flex-col items-center px-4 border-r border-zinc-800">
            <span className="text-[8px] lg:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PONTOS</span>
            <div className="flex items-center space-x-1">
              <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span className="text-xl lg:text-3xl font-black text-white">{user.vorixScore}</span>
            </div>
          </div>
          <div className="flex flex-col items-center px-4">
            <span className="text-[8px] lg:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Badges</span>
            <span className="text-xl lg:text-3xl font-black text-white">{badges.length}</span>
          </div>
        </div>
      </div>

      {/* Special Reward Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-orange-600 to-amber-500 rounded-3xl p-6 lg:p-10 shadow-2xl shadow-orange-600/20 group"
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700" />
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4 lg:space-x-8">
            <div className="w-16 h-16 lg:w-24 lg:h-24 bg-white/20 backdrop-blur-xl rounded-2xl lg:rounded-[2rem] flex items-center justify-center shadow-2xl">
              <Crown className="w-8 h-8 lg:w-12 lg:h-12 text-white" />
            </div>
            <div className="space-y-1 lg:space-y-2">
              <h3 className="text-xl lg:text-3xl font-black text-white tracking-tight">Recompensa Vorix Premium</h3>
              <p className="text-white/80 text-xs lg:text-lg font-medium max-w-md">
                Atingir 5.000 pontos Vorix libera automaticamente **1 mês grátis** de uso ilimitado para assinantes ativos!
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-center space-y-2 lg:space-y-3 min-w-[150px]">
            <div className="text-center">
              <span className="text-[10px] lg:text-xs font-black text-white/70 uppercase tracking-widest">Seu Progresso</span>
              <div className="text-2xl lg:text-5xl font-black text-white tracking-tighter">
                {Math.min(user.vorixScore || 0, 5000)}<span className="text-white/50 text-lg lg:text-2xl">/5000</span>
              </div>
            </div>
            <div className="w-full h-2 lg:h-3 bg-black/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((user.vorixScore || 0) / 5000) * 100, 100)}%` }}
                className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
              />
            </div>
            {user.vorixRewardClaimed && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-white/20 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-white" />
                <span className="text-[9px] font-black text-white uppercase tracking-widest">Recompensa Resgatada</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 lg:space-x-4 p-1.5 bg-zinc-900/50 border border-zinc-800 rounded-2xl lg:rounded-3xl w-fit">
        {[
          { id: 'missions', label: 'Missões', icon: Target },
          { id: 'achievements', label: 'Conquistas', icon: Award },
          { id: 'badges', label: 'Badges', icon: Star },
          { id: 'leaderboard', label: 'Ranking', icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-4 py-2 lg:px-6 lg:py-3 rounded-xl lg:rounded-2xl text-[10px] lg:text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-[#ff4d00] text-white shadow-lg shadow-orange-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'missions' && (
              <motion.div
                key="missions"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {filteredMissions.length > 0 ? renderMissions(filteredMissions) : (
                  <div className="text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800">
                    <Target className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">Nenhuma missão disponível no momento.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'achievements' && (
              <motion.div
                key="achievements"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {filteredAchievements.length > 0 ? renderMissions(filteredAchievements) : (
                  <div className="text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800">
                    <Award className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">Você ainda não desbloqueou conquistas.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'badges' && (
              <motion.div
                key="badges"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 lg:gap-8"
              >
                {badges.length > 0 ? badges.map((badge, index) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    key={badge.id}
                    className="group flex flex-col items-center text-center space-y-3 p-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 hover:border-orange-500/30 transition-all"
                  >
                    <div className="relative w-16 h-16 lg:w-24 lg:h-24">
                      <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-full h-full bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center text-3xl lg:text-5xl shadow-2xl group-hover:scale-110 transition-transform">
                        {badge.icon}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[10px] lg:text-sm font-black text-white tracking-tight">{badge.name}</h4>
                      <p className="text-[8px] lg:text-[10px] text-zinc-500 font-medium line-clamp-2">{badge.description}</p>
                    </div>
                  </motion.div>
                )) : (
                  <div className="col-span-full text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800">
                    <Star className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">Continue evoluindo para desbloquear badges exclusivos.</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'leaderboard' && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-900/40 border border-zinc-800/50 rounded-[2rem] lg:rounded-[3rem] overflow-hidden"
              >
                <div className="p-6 lg:p-10 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/20">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-orange-500/10 rounded-2xl">
                      <Users className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-xl lg:text-3xl font-black text-white tracking-tight">Ranking Global</h3>
                      <p className="text-zinc-500 text-xs lg:text-sm font-medium">Os mestres da evolução financeira.</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-zinc-800 rounded-xl">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Atualizado agora</span>
                  </div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {leaderboard.map((leader, index) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={leader.uid}
                      className={`flex items-center justify-between p-4 lg:p-8 hover:bg-zinc-800/30 transition-all ${leader.uid === user.uid ? 'bg-orange-500/5 border-l-4 border-l-orange-500' : ''}`}
                    >
                      <div className="flex items-center space-x-4 lg:space-x-8">
                        <div className="w-8 lg:w-12 text-center">
                          {index === 0 ? <Crown className="w-6 h-6 lg:w-8 lg:h-8 text-yellow-500 mx-auto" /> :
                           index === 1 ? <Medal className="w-6 h-6 lg:w-8 lg:h-8 text-zinc-300 mx-auto" /> :
                           index === 2 ? <Medal className="w-6 h-6 lg:w-8 lg:h-8 text-amber-600 mx-auto" /> :
                           <span className="text-lg lg:text-2xl font-black text-zinc-700">#{index + 1}</span>}
                        </div>
                        <div className="flex items-center space-x-3 lg:space-x-4">
                          <div className="w-10 h-10 lg:w-14 lg:h-14 rounded-full border-2 border-zinc-800 overflow-hidden bg-zinc-900">
                            {leader.photoURL ? (
                              <img src={leader.photoURL} alt={leader.username} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Users className="w-5 h-5 lg:w-7 lg:h-7 text-zinc-700" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm lg:text-xl font-black text-white tracking-tight flex items-center space-x-2">
                              <span>{leader.username}</span>
                              {leader.uid === user.uid && <span className="px-2 py-0.5 bg-orange-500 text-[8px] rounded-full uppercase">Você</span>}
                            </h4>
                            <p className="text-[10px] lg:text-xs text-zinc-500 font-bold uppercase tracking-widest">
                              Nível {Math.floor((leader.vorixScore || 0) / 1000) + 1}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 lg:space-x-12">
                        <div className="text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <Zap className="w-4 h-4 text-orange-500 fill-orange-500" />
                            <span className="text-base lg:text-2xl font-black text-white">{leader.vorixScore}</span>
                          </div>
                          <span className="text-[8px] lg:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pontos Vorix</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-800" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
