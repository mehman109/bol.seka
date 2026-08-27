import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  Copy,
  Check,
  Upload,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { WalletTransaction, UserProfile } from '../types';
import { soundManager } from '../utils/audio';
import { submitDepositToFirestore, submitWithdrawalToFirestore } from '../services/firebaseService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onWithdraw?: (amount: number) => boolean;
  transactions: WalletTransaction[];
  initialTab?: 'deposit' | 'withdraw' | 'history';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  user,
  transactions,
  initialTab = 'deposit',
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>(initialTab);
  
  // Deposit State
  const DEPOSIT_CARD_NUMBER = '5411249812290497';
  const FORMATTED_DEPOSIT_CARD = '5411 2498 1229 0497';
  const [depositAmount, setDepositAmount] = useState<string>('5');
  const [copiedCard, setCopiedCard] = useState<boolean>(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState<boolean>(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositErrorMsg, setDepositErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Withdrawal State
  const [withdrawCardNumber, setWithdrawCardNumber] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('5');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState<boolean>(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setDepositErrorMsg(null);
      setDepositSuccessMsg(null);
      setWithdrawErrorMsg(null);
      setWithdrawSuccessMsg(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Copy card number to clipboard
  const handleCopyCard = () => {
    navigator.clipboard.writeText(DEPOSIT_CARD_NUMBER);
    setCopiedCard(true);
    soundManager.playPing();
    setTimeout(() => setCopiedCard(false), 2500);
  };

  // Handle receipt image upload from file or gallery
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setDepositErrorMsg('Zəhmət olmasa yalnız şəkil formatında (JPG, PNG) çek əlavə edin.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDepositErrorMsg('Şəklin ölçüsü 10MB-dan çox ola bilməz.');
      return;
    }

    setDepositErrorMsg(null);
    setReceiptFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
      soundManager.playPing();
    };
    reader.readAsDataURL(file);
  };

  // Remove uploaded receipt
  const handleRemoveReceipt = () => {
    setReceiptImage(null);
    setReceiptFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Deposit Request
  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositErrorMsg(null);
    setDepositSuccessMsg(null);

    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum < 5) {
      setDepositErrorMsg('Minimum depozit məbləği 5.00 ₼ olmalıdır.');
      return;
    }

    if (!receiptImage) {
      setDepositErrorMsg('Zəhmət olmasa ödəniş çekinin şəklini "Çek əlavə et" bölməsindən yükləyin.');
      return;
    }

    setIsSubmittingDeposit(true);
    try {
      const docId = await submitDepositToFirestore({
        userId: user.id,
        username: user.username,
        amount: amountNum,
        paymentMethod: `Bank Kartı (${FORMATTED_DEPOSIT_CARD})`,
        receiptName: receiptFileName || 'Ödəniş çeki',
        receiptDataUrl: receiptImage,
      });

      if (docId) {
        soundManager.playWin();
        setDepositSuccessMsg(`✅ ${(amountNum || 0).toFixed(2)} ₼ depozit sorğunuz və çekiniz uğurla göndərildi! Admin təsdiqindən sonra balansınıza əlavə olunacaq.`);
        setReceiptImage(null);
        setReceiptFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setDepositAmount('5');
      } else {
        setDepositErrorMsg('Depozit göndərilərkən xəta baş verdi. Zəhmət olmasa yenidən yoxlayın.');
      }
    } catch (err) {
      console.error(err);
      setDepositErrorMsg('Sistem xətası baş verdi. Zəhmət olmasa yenidən cəhd edin.');
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setWithdrawCardNumber(formatted);
  };

  // Submit Withdrawal Request
  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawErrorMsg(null);
    setWithdrawSuccessMsg(null);

    const cleanCard = withdrawCardNumber.replace(/\s+/g, '');
    if (cleanCard.length !== 16) {
      setWithdrawErrorMsg('Zəhmət olmasa 16 rəqəmli düzgün Bank Kart nömrəsi daxil edin.');
      return;
    }

    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum < 5) {
      setWithdrawErrorMsg('Minimum çıxarış məbləği 5.00 ₼ olmalıdır.');
      return;
    }

    if (amountNum > (user?.balance || 0)) {
      setWithdrawErrorMsg(`Balansınızda kifayət qədər vəsait yoxdur. Mövcud balans: ${((user && user.balance) || 0).toFixed(2)} ₼`);
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const docId = await submitWithdrawalToFirestore({
        userId: user.id,
        username: user.username,
        amount: amountNum,
        cardNumber: withdrawCardNumber,
      });

      if (docId) {
        soundManager.playWin();
        setWithdrawSuccessMsg(`✅ ${(amountNum || 0).toFixed(2)} ₼ məbləğində çıxarış sorğunuz qəbul edildi! Admin təsdiqindən sonra kartınıza köçürüləcək.`);
        setWithdrawAmount('5');
        setWithdrawCardNumber('');
      } else {
        setWithdrawErrorMsg('Çıxarış zamanı xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.');
      }
    } catch (err) {
      console.error(err);
      setWithdrawErrorMsg('Sistem xətası baş verdi. Zəhmət olmasa yenidən cəhd edin.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in font-sans"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141414] border border-[#F59E0B]/30 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#1a1a1a] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B] font-black text-xl shadow-inner">
              ₼
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#F59E0B] tracking-wide flex items-center gap-2">
                <span>Şəxsi Cüzdan</span>
                <span className="text-[10px] px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full border border-[#F59E0B]/30 font-bold uppercase">
                  Seka Club
                </span>
              </h2>
              <p className="text-[11px] text-white/50">{user.username} — Depozit və Çıxarış</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Banner - Dual Balances (Real Withdrawable vs Non-Withdrawable Bonus) */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#0d0d0d] border-b border-white/10 grid grid-cols-2 gap-3">
          <div className="bg-[#141414] border border-green-500/30 rounded-2xl p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Əsas Balans (Çıxarışa Açıq)</span>
              <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-green-400 tracking-tight flex items-baseline gap-1 font-mono">
              <span>{((user && user.balance) || 0).toFixed(2)}</span>
              <span className="text-sm">₼</span>
            </div>
            <span className="text-[9px] text-white/40 block mt-0.5">Depozit və Uduşlar</span>
          </div>

          <div className="bg-[#141414] border border-purple-500/30 rounded-2xl p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Bonus Balansı
              </span>
              <span className="text-[8px] bg-purple-900/50 text-purple-200 px-1.5 py-0.2 rounded font-bold">Yalnız Oyun</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#F59E0B] tracking-tight flex items-baseline gap-1 font-mono">
              <span>{((user && user.bonusBalance) || 0).toFixed(2)}</span>
              <span className="text-sm">₼</span>
            </div>
            <span className="text-[9px] text-purple-300/60 block mt-0.5">Çıxarış Edilmir (Masada Oyna)</span>
          </div>
        </div>

        {/* Navigation Tabs (Depozit, Çıxarış, Tarixçə) */}
        <div className="px-4 sm:px-6 pt-3 bg-[#161616] border-b border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundManager.playPing();
              setActiveTab('deposit');
            }}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-t-xl transition flex items-center justify-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'deposit'
                ? 'bg-[#1f1f1f] text-[#F59E0B] border-[#F59E0B]'
                : 'text-white/60 hover:text-white border-transparent'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-green-400" />
            <span>Depozit (+₼)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playPing();
              setActiveTab('withdraw');
            }}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-t-xl transition flex items-center justify-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'withdraw'
                ? 'bg-[#1f1f1f] text-[#F59E0B] border-[#F59E0B]'
                : 'text-white/60 hover:text-white border-transparent'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-red-400" />
            <span>Çıxarış (-₼)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playPing();
              setActiveTab('history');
            }}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-black rounded-t-xl transition flex items-center justify-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'history'
                ? 'bg-[#1f1f1f] text-[#F59E0B] border-[#F59E0B]'
                : 'text-white/60 hover:text-white border-transparent'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Tarixçə</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: DEPOZİT (BALANS ARTIR) */}
          {activeTab === 'deposit' && (
            <form onSubmit={handleSubmitDeposit} className="space-y-4 animate-in fade-in">
              {/* Official Deposit Card Box with Copy button */}
              <div className="p-4 bg-gradient-to-br from-[#1e1e1e] to-[#121212] border border-[#F59E0B]/40 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Rəsmi Ödəniş Kartı
                  </span>
                  <span className="text-[10px] text-white/50 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                    MilliÖn / eManat / Mobil Bank
                  </span>
                </div>

                <div className="bg-black/70 border border-white/10 p-3 rounded-xl flex items-center justify-between gap-2 mt-1">
                  <div>
                    <span className="text-[10px] text-white/40 block">Köçürmə üçün Kart Nömrəsi:</span>
                    <span className="font-mono font-black text-white text-base sm:text-lg tracking-wider block mt-0.5">
                      {FORMATTED_DEPOSIT_CARD}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCard}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 shrink-0 ${
                      copiedCard
                        ? 'bg-green-600 text-black'
                        : 'bg-[#F59E0B] hover:bg-amber-400 text-black'
                    }`}
                  >
                    {copiedCard ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopyala</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-white/50 mt-2">
                  ℹ️ Zəhmət olmasa bu kart nömrəsinə ödəniş edib, ödəniş çekini aşağıdakı xanaya əlavə edin.
                </p>
              </div>

              {/* Deposit Amount (Min 5.00 AZN) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/80">
                    Depozit Məbləği (₼) <span className="text-green-400 font-bold">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                    Minimum: +5.00 ₼
                  </span>
                </div>

                {/* Amount Input */}
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    step="1"
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Məsələn: 10"
                    className="w-full bg-black/60 border border-white/15 focus:border-[#F59E0B] text-white font-mono font-bold text-lg rounded-2xl p-3.5 pl-4 pr-12 outline-none transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F59E0B] font-bold text-lg">
                    ₼
                  </span>
                </div>

                {/* Quick Presets (+5, +10, +20, +50, +100) */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {['5', '10', '20', '50', '100'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        soundManager.playPing();
                        setDepositAmount(preset);
                      }}
                      className={`py-2 text-xs font-black rounded-xl border transition active:scale-95 cursor-pointer ${
                        depositAmount === preset
                          ? 'bg-[#F59E0B] border-[#F59E0B] text-black shadow-md'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      +{preset} ₼
                    </button>
                  ))}
                </div>
              </div>

              {/* Receipt File / Image Upload Section ("Çek əlavə et xanası") */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/80 flex items-center justify-between">
                  <span>Ödəniş Çeki (Qəbz Şəkli) <span className="text-green-400 font-bold">*</span></span>
                  <span className="text-[10px] text-white/40 font-normal">Qalereyadan seçin</span>
                </label>

                {/* Hidden Real File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="deposit-receipt-file-input"
                />

                {receiptImage ? (
                  /* Uploaded Image Preview */
                  <div className="p-3 bg-black/60 border border-green-500/40 rounded-2xl flex items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={receiptImage}
                        alt="Ödəniş Çeki"
                        className="w-12 h-12 object-cover rounded-xl border border-white/20 shrink-0 bg-black"
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate">
                          {receiptFileName || 'Ödəniş Çeki'}
                        </span>
                        <span className="text-[10px] text-green-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Çek uğurla əlavə edildi
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                      >
                        Dəyiş
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        title="Çeki Sil"
                        className="p-1.5 bg-red-950/80 hover:bg-red-800 text-red-300 rounded-lg transition cursor-pointer border border-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Upload Dropzone / Button */
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-white/20 hover:border-[#F59E0B]/60 bg-black/40 hover:bg-white/5 rounded-2xl transition flex flex-col items-center justify-center gap-2 text-center group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 group-hover:bg-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-[#F59E0B] transition block">
                        Çek Əlavə Et (Qalereya / Fayl)
                      </span>
                      <span className="text-[10px] text-white/40 block mt-0.5">
                        Ödəniş qəbzi şəklini yükləmək üçün toxunun (JPG, PNG)
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {/* Feedback messages */}
              {depositErrorMsg && (
                <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{depositErrorMsg}</span>
                </div>
              )}

              {depositSuccessMsg && (
                <div className="p-4 bg-green-950/90 border-2 border-green-500/60 rounded-2xl text-green-200 text-xs space-y-3 animate-in fade-in shadow-xl">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-white text-sm">{depositSuccessMsg}</p>
                      <p className="text-[11px] text-green-300/90 mt-1 leading-relaxed">
                        🃏 <strong>Masa Oyunçuları üçün Vacib:</strong> Əlinizdəki kartlar və masadakı yeriniz qorunur. Zəhmət olmasa aşağıdakı <strong>"Bağla və Masaya Qayıt"</strong> düyməsinə toxunaraq masaya qayıdın və 5 dəqiqə ərzində admin təsdiqini gözləyin.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-400 hover:brightness-110 text-black font-black text-xs sm:text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 font-black" />
                    <span>Bağla və Masaya Qayıt (5 Dəqiqəni Gözlə)</span>
                  </button>
                </div>
              )}

              {/* Submit Deposit Button */}
              <button
                type="submit"
                disabled={isSubmittingDeposit}
                className="w-full py-3.5 bg-gradient-to-r from-[#F59E0B] via-amber-400 to-[#F59E0B] hover:brightness-110 text-black font-black text-sm rounded-2xl transition shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 cursor-pointer disabled:opacity-50 uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isSubmittingDeposit ? (
                  <span>Göndərilir...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 font-black" />
                    <span>Təsdiqlə və Göndər</span>
                  </>
                )}
              </button>

              {/* Explicit Close / Return to Table Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Pəncərəni Bağla (Masaya Qayıt)</span>
              </button>
            </form>
          )}

          {/* TAB 2: ÇIXARIŞ (PUL ÇƏK) */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleSubmitWithdrawal} className="space-y-4 animate-in fade-in">
              <div className="p-3.5 bg-[#1a1a1a] border border-white/10 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-white/50 block">Çıxarış Üçün Əsas Balans (Depozit/Uduş):</span>
                  <span className="font-mono font-black text-white text-lg block text-green-400">
                    {((user && user.balance) || 0).toFixed(2)} ₼
                  </span>
                </div>
                <div className="text-[10px] text-white/40 text-right">
                  Minimum Çıxarış: <span className="text-amber-400 font-bold">5.00 ₼</span>
                </div>
              </div>

              {/* Bonus Balance Non-Withdrawable Notice */}
              {(user.bonusBalance || 0) > 0 && (
                <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl text-purple-200 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Bonus Balansınız ({((user && user.bonusBalance) || 0).toFixed(2)} ₼):</strong> Yalnız oyun masalarında mərclər üçün nəzərdə tutulub, nağdlaşdırıla və ya çıxarış edilə bilməz. Yalnız depozit və xalis oyun uduşlarınız ({((user && user.balance) || 0).toFixed(2)} ₼) çıxarışa açıqdır.
                  </p>
                </div>
              )}

              {/* Card Number Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 flex items-center justify-between">
                  <span>Kart Nömrəsi Əlavə Et <span className="text-green-400 font-bold">*</span></span>
                  <span className="text-[10px] text-white/40">16 rəqəm</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={19}
                    value={withdrawCardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="XXXX XXXX XXXX XXXX"
                    className="w-full bg-black/60 border border-white/15 focus:border-[#F59E0B] text-white font-mono font-bold text-base rounded-2xl p-3.5 pl-11 outline-none transition tracking-wider"
                  />
                  <CreditCard className="w-5 h-5 text-[#F59E0B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Withdrawal Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/80">
                    Çıxarmaq İstədiyiniz Məbləğ (₼) <span className="text-green-400 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-white/40 font-mono">
                    Maksimum: {((user && user.balance) || 0).toFixed(2)} ₼
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max={user.balance || 0}
                    step="1"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Məsələn: 10"
                    className="w-full bg-black/60 border border-white/15 focus:border-[#F59E0B] text-white font-mono font-bold text-lg rounded-2xl p-3.5 pl-4 pr-12 outline-none transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#F59E0B] font-bold text-lg">
                    ₼
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {['5', '10', '25', '50'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        soundManager.playPing();
                        setWithdrawAmount(preset);
                      }}
                      className={`py-2 text-xs font-black rounded-xl border transition active:scale-95 cursor-pointer ${
                        withdrawAmount === preset
                          ? 'bg-[#F59E0B] border-[#F59E0B] text-black shadow-md'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      {preset} ₼
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playPing();
                      setWithdrawAmount(Math.floor(user?.balance || 0).toString());
                    }}
                    className="py-2 text-xs font-black rounded-xl border bg-white/5 border-white/10 hover:bg-[#F59E0B]/20 hover:border-[#F59E0B] text-[#F59E0B] transition active:scale-95 cursor-pointer"
                  >
                    Hamısı
                  </button>
                </div>
              </div>

              {/* Feedback */}
              {withdrawErrorMsg && (
                <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{withdrawErrorMsg}</span>
                </div>
              )}

              {withdrawSuccessMsg && (
                <div className="p-3 bg-green-950/80 border border-green-500/40 rounded-xl text-green-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
                  <span>{withdrawSuccessMsg}</span>
                </div>
              )}

              {/* Submit Withdrawal Button */}
              <button
                type="submit"
                disabled={isSubmittingWithdraw || (user?.balance || 0) < 5}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:brightness-110 text-white font-black text-sm rounded-2xl transition shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isSubmittingWithdraw ? (
                  <span>Gözləyin...</span>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4 font-black" />
                    <span>Çıxarışı Təsdiqlə</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: TARİXÇƏ (BÜTÜN ƏMƏLİYYATLAR) */}
          {activeTab === 'history' && (
            <div className="space-y-2.5 animate-in fade-in">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-white/40 text-xs flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 text-white/20" />
                  <span>Hələlik əməliyyat qeydi yoxdur.</span>
                </div>
              ) : (
                transactions.map((tx) => {
                  const isPositive = tx.type === 'win' || tx.type === 'bonus' || tx.type === 'deposit';
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 bg-[#0a0a0a] border border-white/10 rounded-2xl flex items-center justify-between hover:border-white/20 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                            isPositive
                              ? 'bg-green-950/80 border border-green-500/40 text-green-400'
                              : 'bg-red-950/80 border border-red-500/40 text-red-400'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
                        </div>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                            <span>
                              {tx.type === 'win'
                                ? 'Qələbə Uduşu'
                                : tx.type === 'bonus'
                                ? (tx.method || 'Bonus')
                                : tx.type === 'deposit'
                                ? 'Depozit'
                                : tx.type === 'withdraw'
                                ? 'Çıxarış Sorğusu'
                                : 'Oyun Mərci'}
                            </span>
                            {tx.status === 'pending' && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-500/40 rounded-full font-bold">
                                Gözləyir
                              </span>
                            )}
                            {tx.status === 'rejected' && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-red-950 text-red-300 border border-red-500/40 rounded-full font-bold">
                                İmtina
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-white/40 mt-0.5">
                            {tx.date} {tx.method && `• ${tx.method}`}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`font-black text-sm sm:text-base font-mono ${
                          isPositive ? 'text-green-400' : 'text-white/80'
                        }`}
                      >
                        {isPositive ? '+' : '-'}
                        {((tx && tx.amount) || 0).toFixed(2)} ₼
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#111] border-t border-white/10 text-center">
          <p className="text-[11px] text-white/40">
            Bütün depozit və çıxarış əməliyyatları Admin tərəfindən 24/7 yoxlanılır və təsdiqlənir.
          </p>
        </div>
      </div>
    </div>
  );
};
