import React, { useState } from 'react';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from '../lib/storage';
import { motion } from 'motion/react';
import { TrendingUp, ShieldCheck, Zap, Mail, Lock, User as UserIcon, ArrowRight, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'forgot-password';

export const Auth: React.FC = () => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (view === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (view === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
      } else if (view === 'forgot-password') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Ocorreu um erro na autenticação.';
      if (err.code === 'auth/user-not-found') message = 'Usuário não encontrado.';
      if (err.code === 'auth/wrong-password') message = 'Senha incorreta.';
      if (err.code === 'auth/email-already-in-use') message = 'Este e-mail já está em uso.';
      if (err.code === 'auth/weak-password') message = 'A senha deve ter pelo menos 6 caracteres.';
      if (err.code === 'auth/invalid-email') message = 'E-mail inválido.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-40 z-0 pointer-events-none"
      >
        <source src="/a9cc6c17-3d54-41c8-ac23-c2e94d465e70" type="video/mp4" />
      </video>

      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-transparent to-zinc-950/80 z-0 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 100, 
          damping: 15, 
          bounce: 0.5,
          duration: 0.8
        }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-20 h-20 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <TrendingUp className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">VORIX</h1>
          <p className="text-zinc-400">Gestão Financeira Inteligente com IA</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl space-y-6">
          {view !== 'forgot-password' ? (
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => { setView('login'); setError(null); setShowPassword(false); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${view === 'login' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Entrar
              </button>
              <button
                onClick={() => { setView('signup'); setError(null); setShowPassword(false); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${view === 'signup' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Criar Conta
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setView('login'); setError(null); setResetSent(false); }}
              className="flex items-center space-x-2 text-zinc-400 hover:text-white transition-all text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o login</span>
            </button>
          )}

          {resetSent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="text-emerald-500 w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-bold">E-mail enviado!</h3>
                <p className="text-zinc-500 text-sm">
                  Enviamos um link de recuperação para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.
                </p>
              </div>
              <button
                onClick={() => { setView('login'); setResetSent(false); }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Voltar para o login
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'forgot-password' && (
                <div className="space-y-2">
                  <h3 className="text-white font-bold text-lg">Recuperar Senha</h3>
                  <p className="text-zinc-500 text-sm">Digite seu e-mail para receber um link de redefinição de senha.</p>
                </div>
              )}

              {view === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Nome de Usuário</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Como quer ser chamado?"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-600 focus:border-orange-600 transition-all outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-600 focus:border-orange-600 transition-all outline-none"
                  />
                </div>
              </div>

              {view !== 'forgot-password' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Senha</label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setView('forgot-password'); setError(null); }}
                        className="text-xs font-bold text-orange-600 hover:text-orange-500 transition-all"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-12 pr-12 py-3 text-sm text-white focus:ring-1 focus:ring-orange-600 focus:border-orange-600 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-all"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-rose-500 text-xs font-medium ml-1"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-600/20 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>
                      {view === 'login' ? 'Entrar na Vorix' : 
                       view === 'signup' ? 'Criar minha conta' : 
                       'Enviar link de recuperação'}
                    </span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 text-left">
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-start space-x-4">
            <ShieldCheck className="text-orange-500 w-6 h-6 mt-1" />
            <div>
              <h3 className="text-white font-medium">Segurança Total</h3>
              <p className="text-zinc-500 text-sm">Seus dados protegidos com criptografia de ponta.</p>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex items-start space-x-4">
            <Zap className="text-orange-500 w-6 h-6 mt-1" />
            <div>
              <h3 className="text-white font-medium">IA Advisor</h3>
              <p className="text-zinc-500 text-sm">Dicas personalizadas para economizar e investir melhor.</p>
            </div>
          </div>
        </div>

        <p className="text-zinc-600 text-xs text-center">
          Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade.
        </p>
      </motion.div>
    </div>
  );
};
