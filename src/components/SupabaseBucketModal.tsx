import React, { useState } from 'react';
import { X, Database, CheckCircle2, RefreshCw, Info, ExternalLink, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabaseBucketUrl, setSupabaseBucketUrl } from '../lib/imageUtils';

interface SupabaseBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBucketUpdated?: () => void;
}

export const SupabaseBucketModal: React.FC<SupabaseBucketModalProps> = ({
  isOpen,
  onClose,
  onBucketUpdated
}) => {
  const [urlInput, setUrlInput] = useState(() => getSupabaseBucketUrl());
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setSupabaseBucketUrl('');
      setStatusMessage({ type: 'info', text: 'Supabase Bucket URL was cleared. Using local image fallbacks.' });
      if (onBucketUpdated) onBucketUpdated();
      setTimeout(() => onClose(), 1200);
      return;
    }

    let formattedUrl = trimmed.replace(/\/+$/, '');
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setSupabaseBucketUrl(formattedUrl);
    setUrlInput(formattedUrl);
    setStatusMessage({
      type: 'success',
      text: 'Supabase Storage Bucket URL linked successfully! Images will now load permanently from your bucket.'
    });

    if (onBucketUpdated) onBucketUpdated();
  };

  const handleReset = () => {
    setSupabaseBucketUrl('');
    setUrlInput('');
    setStatusMessage({ type: 'info', text: 'Storage URL reset to default.' });
    if (onBucketUpdated) onBucketUpdated();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-4 font-sans">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-[#121212] border border-aero-yellow/30 shadow-2xl rounded-sm w-full max-w-xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-black/80 px-3 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-aero-yellow/10 border border-aero-yellow/40 flex items-center justify-center text-aero-yellow">
                <Database size={20} />
              </div>
              <div>
                <h2 className="text-lg font-mono font-black uppercase tracking-widest text-aero-yellow">
                  Supabase Image Bucket
                </h2>
                <p className="text-[11px] font-mono text-white/50">
                  Permanent aircraft image storage binding
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white p-1 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-5 overflow-y-auto max-h-[80vh] custom-scrollbar">
            <div className="bg-black/40 border border-white/10 p-4 rounded-sm space-y-2">
              <div className="flex items-center gap-2 text-aero-yellow text-xs font-mono font-bold uppercase tracking-wider">
                <Info size={14} />
                <span>How to connect your Supabase Bucket</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed font-sans">
                Paste the public URL to your Supabase storage bucket containing aircraft images below. The application will automatically scan for matching aircraft names (<code className="text-aero-yellow bg-white/5 px-1 py-0.5 rounded font-mono">Boeing 737-800</code>, <code className="text-aero-yellow bg-white/5 px-1 py-0.5 rounded font-mono">A320neo</code>, etc.) in JPG, PNG, or WebP format.
              </p>
            </div>

            {/* Input Form */}
            <div className="space-y-2">
              <label className="block text-xs font-mono uppercase tracking-widest text-white/70 font-bold">
                Supabase Bucket Public URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://xxxx.supabase.co/storage/v1/object/public/your-bucket-name"
                  className="flex-1 bg-black border border-white/20 rounded-sm px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-aero-yellow transition-colors placeholder:text-white/20"
                />
              </div>
              <p className="text-[10px] font-mono text-white/40">
                Example format: <span className="text-white/60">https://xyz.supabase.co/storage/v1/object/public/planes</span>
              </p>
            </div>

            {/* Status Alert */}
            {statusMessage && (
              <div
                className={`p-3 rounded-sm border font-mono text-xs flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-aero-yellow/10 border-aero-yellow/20 text-aero-yellow'
                    : statusMessage.type === 'error'
                    ? 'bg-[#111] border-white/20 text-aero-yellow/60'
                    : 'bg-aero-yellow/10 border-aero-yellow/30 text-aero-yellow'
                }`}
              >
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Example Bucket Structure Helper */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-white/50 font-bold block">
                Supported Bucket Structures
              </span>
              <div className="bg-black/60 border border-white/5 p-3 rounded-sm font-mono text-[11px] text-white/70 space-y-1">
                <div>📁 <span className="text-aero-yellow font-bold">your-bucket/</span></div>
                <div className="pl-4">├── 📁 Boeing 737-800 / <span className="text-white/40">image.jpg (or image.png)</span></div>
                <div className="pl-4">├── 📁 A320neo / <span className="text-white/40">image.jpg</span></div>
                <div className="pl-4">├── 📄 Boeing-737-800.png</div>
                <div className="pl-4">└── 📄 a320neo.jpg</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-black/90 px-3 py-4 border-t border-white/10 flex items-center justify-between shrink-0 gap-3">
            <button
              onClick={handleReset}
              className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-mono text-xs px-4 py-2 border border-white/10 rounded-sm transition-colors"
            >
              Reset / Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="bg-transparent hover:bg-white/5 text-white/60 font-mono text-xs px-4 py-2 rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-aero-yellow text-black font-mono font-bold uppercase tracking-widest text-xs px-5 py-2 hover:bg-white transition-all transform active:scale-95 shadow-lg flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                Save & Link Bucket
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
