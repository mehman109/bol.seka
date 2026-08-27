import React, { useState, useRef, useEffect } from 'react';
import { X, Headphones, Send, Bot, User, CheckCircle2, ShieldCheck } from 'lucide-react';
import { soundManager } from '../utils/audio';
import { UserProfile } from '../types';
import { 
  sendAdminMessageToFirestore, 
  subscribeToAdminMessages, 
  AdminMessage 
} from '../services/firebaseService';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile;
}

interface DisplayMessage {
  id: string;
  sender: 'bot' | 'user' | 'admin';
  text: string;
  time: string;
}

let supportMsgCounter = 0;
const generateSupportMsgId = (prefix = 'msg') =>
  `${prefix}-${Date.now()}-${++supportMsgCounter}-${Math.random().toString(36).slice(2, 7)}`;

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose, user }) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: `Salam ${user?.username || 'Oyunçu'}! ♠ KAROL Seka Canlı Dəstək və Admin Xidmətinə xoş gəlmisiniz. Adminə birbaşa mesajınızı və ya sualınızı buradan göndərə bilərsiniz.`,
      time: 'İndi',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync with Firestore admin messages if user ID exists
  useEffect(() => {
    if (!user?.id || !isOpen) return;

    const unsub = subscribeToAdminMessages(user.id, (adminMsgs: AdminMessage[]) => {
      if (adminMsgs && adminMsgs.length > 0) {
        const mapped: DisplayMessage[] = adminMsgs.map((m) => ({
          id: m.id || generateSupportMsgId('fb'),
          sender: m.sender,
          text: m.text,
          time: m.date ? m.date.slice(11, 16) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        
        // Merge with initial bot greeting
        setMessages([
          {
            id: '1',
            sender: 'bot',
            text: `Salam ${user?.username || 'Oyunçu'}! ♠ KAROL Seka Canlı Dəstək və Admin Xidmətinə xoş gəlmisiniz. Adminə birbaşa mesajınızı və ya sualınızı buradan göndərə bilərsiniz.`,
            time: 'İndi',
          },
          ...mapped,
        ]);
      }
    });

    return () => {
      unsub();
    };
  }, [user?.id, user?.username, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const quickQuestions = [
    'Adminlə əlaqə qurmaq istəyirəm',
    'Depozit necə təsdiqlənir?',
    '3 Tuz neçə xaldır?',
    'Balansımı necə çıxara bilərəm?',
    'Təklif və iradlar',
  ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setIsSending(true);
    soundManager.playPing();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: DisplayMessage = {
      id: generateSupportMsgId('usr'),
      sender: 'user',
      text,
      time: timeNow,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSentNotice(true);
    setTimeout(() => setSentNotice(false), 3000);

    // 1. Send to Firestore collection for Admin
    if (user) {
      await sendAdminMessageToFirestore({
        userId: user.id,
        username: user.username,
        text,
        subject: 'Dəstək Müraciəti',
      });
    }

    // 2. Responsive assistant auto-reply
    setTimeout(() => {
      let reply = 'Mesajınız admin heyətinə uğurla çatdırıldı. Admin 1-2 dəqiqə ərzində cavablandıracaq.';
      const lower = text.toLowerCase();
      if (lower.includes('depozit') || lower.includes('artır') || lower.includes('çek')) {
        reply = 'Depozit çekinizi Cüzdan bölməsindən yükləmisinizsə, adminlər onu yoxlayıb anında balansınıza təsdiqləyirlər.';
      } else if (lower.includes('tuz') || lower.includes('33')) {
        reply = 'Seka qaydalarına əsasən 3 Tuz (A-A-A) 33 xal təşkil edir və oyunun ən güclü kombinasiyasıdır.';
      } else if (lower.includes('çıxarış') || lower.includes('pul')) {
        reply = 'Qazandığınız məbləği Cüzdan > Çıxarış bölməsindən m10 və ya yerli bank kartınıza komissiyasız çıxara bilərsiniz.';
      } else if (lower.includes('admin') || lower.includes('əlaqə') || lower.includes('elaqe')) {
        reply = 'Müraciətiniz Admin xəttinə ötürüldü. Növbətçi admin qısa zamanda sizinlə əlaqə saxlayacaq.';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: generateSupportMsgId('bot'),
          sender: 'admin',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      soundManager.playPing();
      setIsSending(false);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="bg-[#181818] border border-[#F59E0B]/30 w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[520px] max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#111] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center text-[#F59E0B]">
                <Headphones className="w-5 h-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#111]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>Dəstək Xidməti & Admin</span>
              </h2>
              <div className="flex items-center gap-1 text-[11px] text-green-400 font-medium">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin xətdədir • 24/7 Aktiv</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 text-white/60 hover:text-white flex items-center justify-center hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice of delivery */}
        {sentNotice && (
          <div className="px-4 py-1.5 bg-green-950/80 border-b border-green-500/30 text-green-300 text-[11px] font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mesajınız adminə göndərildi!</span>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0a0a0a]">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            const isAdmin = m.sender === 'admin';

            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                    isUser
                      ? 'bg-[#F59E0B] text-black font-bold'
                      : isAdmin
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-[#1a1a1a] text-[#F59E0B] border border-white/10'
                  }`}
                >
                  {isUser ? (
                    <User className="w-4 h-4" />
                  ) : isAdmin ? (
                    <Headphones className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[78%] p-3 rounded-2xl text-xs ${
                    isUser
                      ? 'bg-[#F59E0B] text-black font-bold rounded-tr-none'
                      : isAdmin
                      ? 'bg-[#262015] border border-[#F59E0B]/40 text-amber-100 rounded-tl-none shadow-md'
                      : 'bg-[#1a1a1a] border border-white/10 text-white/90 rounded-tl-none'
                  }`}
                >
                  {isAdmin && (
                    <span className="text-[10px] text-[#F59E0B] font-black block mb-0.5 uppercase tracking-wider">
                      Admin Cavabı
                    </span>
                  )}
                  <p className="leading-relaxed">{m.text}</p>
                  <span
                    className={`text-[9px] block mt-1 text-right ${
                      isUser ? 'text-black/60 font-mono' : 'text-white/40 font-mono'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Question Chips */}
        <div className="p-2 bg-[#111] border-t border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#F59E0B]/20 text-white/70 hover:text-[#F59E0B] border border-white/10 text-[11px] font-medium transition cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Message Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-[#111] border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Admine mesajınızı yazın..."
            className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#F59E0B]"
          />
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="w-10 h-10 rounded-xl bg-[#F59E0B] hover:bg-[#F59E0B]/90 disabled:opacity-40 text-black flex items-center justify-center font-bold transition shadow-md shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4 font-black" />
          </button>
        </form>
      </div>
    </div>
  );
};
