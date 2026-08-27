import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, roomId }) => {
  const [reason, setReason] = useState('suspicious');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playPing();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setDescription('');
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/30 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-amber-400">Şikayət Bildirişi</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Şikayətiniz qəbul edildi</h3>
              <p className="text-xs text-slate-400">
                Təhlükəsizlik komandamız otağı və oyunçu hərəkətlərini ən qısa zamanda yoxlayacaq.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-xs text-slate-400">
                Otaq: <span className="font-bold text-amber-400">{roomId || '#611420'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Şikayət Səbəbi</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="suspicious">Şübhəli oyun / Razılaşma (Teaming)</option>
                  <option value="abuse">Çatda təhqiramiz ifadələr</option>
                  <option value="afk">Qəsdən oyunu ləngitmə (Slow play)</option>
                  <option value="other">Digər səbəb</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Ətraflı İzah (İstəyə bağlı)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Hadisəni qısaca təsvir edin..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 placeholder-slate-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md"
              >
                Şikayəti Göndər
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
