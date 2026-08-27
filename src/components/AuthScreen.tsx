import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, User, Lock, Mail, Sparkles, ArrowRight, Eye, EyeOff, Loader2, ShieldAlert, X } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from '../firebase';
import { 
  syncUserProfileToFirestore, 
  getUserProfileFromFirestore,
  checkDeviceRegistration,
  registerDeviceInFirestore
} from '../services/firebaseService';
import { 
  getDeviceFingerprint, 
  markDeviceAsLocallyRegistered, 
  isDeviceLocallyRegistered 
} from '../utils/deviceFingerprint';
import { UserProfile } from '../types';

interface AuthScreenProps {
  onLogin: (userProfile: UserProfile) => void;
  onOpenSupport: () => void;
  onOpenAdmin: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onOpenSupport, onOpenAdmin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Admin login popup states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');

  // Safe email helper for username-based login
  const getFirebaseEmail = (userOrEmail: string) => {
    const trimmed = userOrEmail.trim().toLowerCase();
    if (trimmed.includes('@') && trimmed.includes('.')) {
      return trimmed;
    }
    const map: Record<string, string> = {
      'ə': 'e', 'ı': 'i', 'i̇': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
    };
    const transliterated = trimmed.split('').map(c => map[c] || c).join('');
    const cleanUser = transliterated.replace(/[^a-z0-9_]/g, '');
    return `${cleanUser || 'user'}@sekaclub.az`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegister) {
      if (!email.trim() || !email.includes('@') || !email.includes('.')) {
        setError('Zəhmət olmasa düzgün e-poçt ünvanınızı daxil edin');
        return;
      }
      if (!username.trim()) {
        setError('Zəhmət olmasa istifadəçi adınızı daxil edin');
        return;
      }
    } else {
      if (!username.trim()) {
        setError('Zəhmət olmasa istifadəçi adınızı və ya e-poçtunuzu daxil edin');
        return;
      }
    }

    if (!password.trim() || password.length < 6) {
      setError('Şifrə minimum 6 simvoldan ibarət olmalıdır');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (isRegister) {
        // 1. Device Hardware Fingerprint & IMEI Anti-Duplicate Security Check
        const deviceInfo = getDeviceFingerprint();
        const localCheck = isDeviceLocallyRegistered();

        // Check Firestore registered devices collection
        const deviceCheck = await checkDeviceRegistration(deviceInfo.deviceId, deviceInfo.imei);

        if (deviceCheck.isBlocked || (localCheck.isRegistered && localCheck.username?.toLowerCase() !== username.trim().toLowerCase())) {
          soundManager.playFold();
          setError('🚫 Təhlükəsizlik Sistemi: Bu cihazdan (IMEI / Cihaz İD) artıq qeydiyyatdan keçilib və 5.00 ₼ bonus istifadə edilib! Hər cihazdan yalnız 1 hesab qeydiyyatına icazə verilir. Zəhmət olmasa mövcud hesabınızla daxil olun.');
          setIsLoading(false);
          return;
        }

        const validEmail = email.trim().toLowerCase();

        // 2. Register in Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, validEmail, password);
        await updateProfile(cred.user, {
          displayName: username.trim(),
        });

        // Initialize Firestore Profile: Bonus balance starts at 0.00 ₼, user can press "Bonus 5.00 ₼" button to claim 5.00 AZN bonus
        const newProfile: UserProfile = {
          id: cred.user.uid,
          username: username.trim(),
          email: validEmail,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username.trim()}`,
          balance: 0.00, // Əsas Cüzdan Balansı (0.00 ₼)
          bonusBalance: 0.00, // Bonus Balansı (0.00 ₼)
          gamesPlayed: 0,
          gamesWon: 0,
          biggestPotWon: 0,
          sekaCount: 0,
          bonusClaimed: false,
        };

        await syncUserProfileToFirestore(newProfile);

        // Record device fingerprint & IMEI in Firestore
        await registerDeviceInFirestore({
          deviceId: deviceInfo.deviceId,
          imei: deviceInfo.imei,
          userId: cred.user.uid,
          username: username.trim(),
          email: validEmail,
          fingerprint: deviceInfo.fingerprint,
        });

        // Mark device in local browser
        markDeviceAsLocallyRegistered(username.trim());

        soundManager.playWin();
        onLogin(newProfile);
      } else {
        // Sign in via Firebase Auth
        const targetEmail = getFirebaseEmail(username);
        let cred;
        try {
          cred = await signInWithEmailAndPassword(auth, targetEmail, password);
        } catch (signInErr: any) {
          // If username format or email fallback attempt is needed
          if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found') {
            const rawClean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
            const fallbackEmail = `${rawClean || 'user'}@sekaclub.az`;
            if (fallbackEmail !== targetEmail) {
              try {
                cred = await signInWithEmailAndPassword(auth, fallbackEmail, password);
              } catch {
                throw signInErr;
              }
            } else {
              throw signInErr;
            }
          } else {
            throw signInErr;
          }
        }
        
        // Fetch or create user in Firestore
        let profile = await getUserProfileFromFirestore(cred.user.uid);
        if (!profile) {
          profile = {
            id: cred.user.uid,
            username: cred.user.displayName || username.trim(),
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cred.user.uid}`,
            balance: 0.00,
            bonusBalance: 0.00,
            gamesPlayed: 0,
            gamesWon: 0,
            biggestPotWon: 0,
            sekaCount: 0,
            bonusClaimed: false,
          };
          await syncUserProfileToFirestore(profile);
        }

        soundManager.playPing();
        onLogin(profile);
      }
    } catch (err: any) {
      console.warn('Firebase Auth error:', err?.code, err?.message);
      // Fallback gracefully with user-friendly error messages
      if (err.code === 'auth/email-already-in-use') {
        setError('Bu e-poçt və ya istifadəçi adı artıq qeydiyyatdan keçib. Daxil olun və ya başqa e-poçt daxil edin.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('İstifadəçi adı / e-poçt və ya şifrə yanlışdır. Əgər hesabınız yoxdursa, "Qeydiyyat" bölməsinə keçin.');
      } else if (err.code === 'auth/user-not-found') {
        setError('Bu hesab tapılmadı. Zəhmət olmasa "Qeydiyyat" bölməsinə keçərək qeydiyyatdan keçin.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Daxil edilən e-poçt formatı düzgün deyil.');
      } else {
        setError(err.message || 'Giriş zamanı xəta baş verdi. Zəhmət olmasa yenidən yoxlayın.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background dot matrix pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" />

      {/* Top Header & SEKA CLUB Logo */}
      <header className="w-full pt-8 pb-4 flex flex-col items-center justify-center relative z-10">
        <div className="flex items-center gap-3 bg-gradient-to-r from-black/60 via-[#1e1e1e] to-black/60 px-5 py-2.5 rounded-2xl border border-[#F59E0B]/40 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F59E0B] via-amber-400 to-yellow-300 p-0.5 shadow-[0_0_25px_rgba(245,158,11,0.4)]">
            <div className="w-full h-full bg-[#0a0a0a] rounded-[14px] flex items-center justify-center">
              <span className="text-2xl font-black text-[#F59E0B]">♠</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-[#F59E0B] font-serif leading-none">
              SEKA CLUB
            </h1>
            <p className="text-[10px] tracking-[0.22em] font-extrabold text-[#F59E0B]/90 uppercase mt-1">
              Ənənəvi Seka Klubu
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 relative z-10 w-full max-w-md mx-auto">
        {/* Banner Card */}
        <div className="w-full mb-6 p-4 rounded-2xl bg-[#1a1a1a] border border-[#F59E0B]/30 backdrop-blur-md shadow-xl text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10 text-[#F59E0B] text-6xl select-none font-serif">
            ♠
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B] text-[11px] font-black uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>3 KART HƏYƏCANI & CANLI OYUN</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white">
            Ənənəvi Seka — 3 kart oyunu
          </h2>
          <p className="text-xs sm:text-sm font-bold text-[#F59E0B] mt-1">
            Qeydiyyatdan keç — 5.00 ₼ dərhal qeydiyyat balansı qazan
          </p>
        </div>

        {/* Auth Form Block */}
        <div className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
          {/* Tab Selector: Giriş / Qeydiyyat */}
          <div className="flex bg-[#0a0a0a] p-1 rounded-xl border border-white/10 mb-5">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                !isRegister
                  ? 'bg-[#F59E0B] text-black shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              GİRİŞ (DAXİL OL)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                isRegister
                  ? 'bg-[#F59E0B] text-black shadow-md'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              QEYDİYYAT (+5₼ BONUS)
            </button>
          </div>

          <div className="mb-4 text-center">
            <h3 className="text-base sm:text-lg font-black text-white">
              {isRegister ? 'Yeni Oyunçu Qeydiyyatı' : 'Mövcud Hesabla Giriş'}
            </h3>
            <p className="text-xs text-white/50 mt-1">
              {isRegister
                ? 'İstifadəçi adı, e-poçt və şifrənizi daxil edərək qeydiyyatdan keçin'
                : 'Masalarda oyuna başlamaq üçün hesabınıza daxil olun'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-2.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold animate-in fade-in text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-poçt xanası (Yalnız Qeydiyyat rejimində ayrıca tələb olunur) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">
                  E-poçt (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    disabled={isLoading}
                    placeholder="Məs: oyuncu@gmail.com"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B] transition"
                  />
                </div>
              </div>
            )}

            {/* İstifadəçi adı xanası */}
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5">
                {isRegister ? 'İstifadəçi adı (Username)' : 'İstifadəçi adı və ya E-poçt'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  placeholder={isRegister ? 'Məs: Babek_007' : 'İstifadəçi adı və ya e-poçt'}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B] transition"
                />
              </div>
            </div>

            {/* Şifrə xanası */}
            <div>
              <label className="block text-xs font-bold text-white/70 mb-1.5">
                Şifrə (Parol - min 6 simvol)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Action Button: "Qeydiyyatı Təsdiq Et" və ya "Daxil ol" */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-[#F59E0B] hover:bg-[#F59E0B]/90 disabled:opacity-50 text-black font-black rounded-xl text-sm transition shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-[0.98] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Yoxlanılır...</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Qeydiyyatı Təsdiq Et' : 'Daxil ol'}</span>
                  <ArrowRight className="w-4 h-4 font-black" />
                </>
              )}
            </button>
          </form>

          {/* Switch text */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-xs font-bold text-white/60 hover:text-[#F59E0B] transition cursor-pointer"
            >
              {isRegister ? (
                <span>
                  Artıq hesabınız var? <strong className="text-[#F59E0B] underline">Daxil olun</strong>
                </span>
              ) : (
                <span>
                  Hesabınız yoxdur? <strong className="text-[#F59E0B] underline">Qeydiyyatdan keçin</strong>
                </span>
              )}
            </button>
          </div>

          {/* Admin Girişi Düyməsi (Giriş Ekranının Alt Hissəsində) */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundManager.playPing();
                setAdminError('');
                setAdminPin('');
                setIsAdminModalOpen(true);
              }}
              className="w-full py-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 text-red-300 hover:text-red-200 border border-red-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>🔐 Admin Girişi (Depozit və Qeydiyyat Nəzarəti)</span>
            </button>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-white/40 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Təhlükəsiz Giriş və Ədalətli Oyun Zəmanəti</span>
        </div>
      </main>

      {/* Admin Login Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#181818] border border-red-500/40 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Admin Girişi</h3>
                  <p className="text-[10px] text-white/50">İdarəetmə Paneli Giriş Kodu</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdminModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Check Admin PIN: exactly #M7725368@
                if (adminPin === '#M7725368@') {
                  soundManager.playWin();
                  setIsAdminModalOpen(false);
                  onOpenAdmin();
                } else {
                  soundManager.playFold();
                  setAdminError('Admin PIN yanlışdır! Zəhmət olmasa düzgün PIN daxil edin.');
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">
                  Admin PIN Kodu
                </label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value);
                    setAdminError('');
                  }}
                  placeholder="PIN daxil edin"
                  className="w-full bg-black border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500"
                />
                {adminError && (
                  <p className="text-[10px] font-bold text-red-400 mt-1">{adminError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider"
              >
                Admin Panelinə Daxil Ol
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer support link */}
      <footer className="w-full py-4 text-center text-xs text-white/40 relative z-10 flex items-center justify-center gap-4">
        <span>© 2026 SEKA CLUB</span>
        <span>•</span>
        <button
          onClick={onOpenSupport}
          className="text-[#F59E0B] hover:underline font-semibold cursor-pointer"
        >
          Canlı Dəstək (24/7)
        </button>
      </footer>
    </div>
  );
};
