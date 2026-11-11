/** The save and load dialog: the list of savegames, with overwrite and delete confirmations. */
import { useState } from 'react';
import { AlertTriangle, ChevronRight, Trash2, X } from 'lucide-react';
import type { SaveMetadata } from '../lib/cloudSaves';

export function SaveLoadOverlay({ 
  saves, 
  onSave, 
  onLoad, 
  onDelete, 
  onClose, 
  mode 
}: { 
  saves: SaveMetadata[], 
  onSave?: (id?: string, name?: string) => void, 
  onLoad?: (id: string) => void, 
  onDelete: (id: string) => void, 
  onClose: () => void,
  mode: 'save' | 'load'
}) {
  const [saveName, setSaveName] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleAction = () => {
    if (mode === 'save') {
      if (selectedSlot) {
        setShowOverwriteConfirm(true);
      } else {
        onSave?.(undefined, saveName);
      }
    } else {
      if (selectedSlot) {
        onLoad?.(selectedSlot);
      }
    }
  };

  const handleConfirmOverwrite = () => {
    onSave?.(selectedSlot || undefined, saveName);
    setShowOverwriteConfirm(false);
  };

  const handleConfirmDelete = () => {
    if (showDeleteConfirm) {
      onDelete(showDeleteConfirm);
      if (selectedSlot === showDeleteConfirm) setSelectedSlot(null);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-ground/90 flex items-center justify-center p-4">
      <div
        className="bg-surface border border-line w-full max-w-lg overflow-hidden flex flex-col animate-appear"
      >
        <div className="p-4 border-b border-line flex justify-between items-center bg-ground/40">
           <h2 className="font-label text-ink font-semibold uppercase tracking-label text-2xs">{mode === 'save' ? 'Operation: PERSISTENCE' : 'Operation: RESTORATION'}</h2>
           <button onClick={onClose} className="text-muted hover:text-ink"><X size={20}/></button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto max-h-[60vh]">
          <div className="grid gap-2 mb-3">
            {saves.length === 0 ? (
              <div className="text-muted font-label text-xs p-12 text-center border border-dashed border-line uppercase tracking-label">
                No telemetry archives discovered
              </div>
            ) : (
              [...saves].sort((a, b) => b.timestamp - a.timestamp).map(slot => (
                <div 
                  key={slot.id}
                  onClick={() => {
                    setSelectedSlot(slot.id);
                    if (mode === 'save') setSaveName(slot.name);
                  }}
                  className={`group p-4 border transition-all cursor-pointer flex justify-between items-center ${selectedSlot === slot.id ? 'bg-accent/10 border-accent' : 'bg-surface border-line hover:border-rule'}`}
                >
                  <div className="flex flex-col">
                    <span className={`text-sm font-semibold ${selectedSlot === slot.id ? 'text-accent' : 'text-ink'}`}>{slot.name}</span>
                    <span className="text-2xs font-mono text-muted">{new Date(slot.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {mode === 'load' && selectedSlot === slot.id && <ChevronRight className="text-accent" size={16} />}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(slot.id); }}
                      className="opacity-0 group-hover:opacity-100 p-2 text-muted border border-transparent hover:text-accent hover:border-rule hover:bg-surface transition-all rounded-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {mode === 'save' && (
            <div className="space-y-4">
              <div className="h-px bg-raised"></div>
              <div className="space-y-2">
                <label className="text-2xs uppercase font-semibold tracking-label text-muted">Archive_name_input</label>
                <input 
                  type="text" 
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Designate save archive..."
                  className="w-full bg-ground border border-line p-4 text-ink text-sm focus:outline-none focus:border-accent/50 transition-all placeholder:text-muted"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-ground/40 border-t border-line flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 border border-line text-ink font-semibold uppercase tracking-label hover:bg-raised transition-all text-xs"
          >
            Back
          </button>
          <button 
            onClick={handleAction}
            disabled={mode === 'save' ? !saveName.trim() : !selectedSlot}
            className={`flex-1 py-4 font-semibold uppercase tracking-label transition-all text-xs ${mode === 'save' ? 'bg-accent text-on-accent hover:bg-ink' : 'bg-accent text-on-accent hover:bg-ink'} disabled:opacity-30`}
          >
            {mode === 'save' ? 'Save' : 'Load'}
          </button>
        </div>

        <>
          {showOverwriteConfirm && (
            <div
              className="absolute inset-0 bg-ground/95 flex items-center justify-center p-4 z-[100] animate-appear"
            >
              <div className="text-center space-y-6 max-w-sm">
                 <div className="flex justify-center">
                    <AlertTriangle className="text-accent" size={64} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="font-label text-ink text-xl font-semibold">Overwrite Archive?</h3>
                   <p className="text-muted text-sm">Initializing this sequence will permanently erase the prior telemetry state for "{saves.find(s => s.id === selectedSlot)?.name}".</p>
                 </div>
                 <div className="flex gap-4 w-full">
                   <button 
                     onClick={() => setShowOverwriteConfirm(false)}
                     className="flex-1 py-3 border border-line text-ink font-semibold uppercase tracking-label hover:bg-raised transition-all text-xs"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleConfirmOverwrite}
                     className="flex-1 py-3 bg-raised text-ink font-semibold uppercase tracking-label hover:bg-raised transition-all text-xs"
                   >
                     Overwrite
                   </button>
                 </div>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div
              className="absolute inset-0 bg-ground/95 flex items-center justify-center p-4 z-[100] animate-appear"
            >
              <div className="text-center space-y-6 max-w-sm">
                 <div className="flex justify-center">
                    <Trash2 className="text-accent" size={64} />
                 </div>
                 <div className="space-y-2">
                   <h3 className="font-label text-ink text-xl font-semibold">Erase Archive?</h3>
                   <p className="text-muted text-sm">Are you sure you want to delete this telemetry archive? This action cannot be undone.</p>
                 </div>
                 <div className="flex gap-4 w-full">
                   <button 
                     onClick={() => setShowDeleteConfirm(null)}
                     className="flex-1 py-3 border border-line text-ink font-semibold uppercase tracking-label hover:bg-raised transition-all text-xs"
                   >
                     Back
                   </button>
                   <button 
                     onClick={handleConfirmDelete}
                     className="flex-1 py-3 bg-raised text-ink font-semibold uppercase tracking-label hover:bg-raised transition-all text-xs"
                   >
                     Delete
                   </button>
                 </div>
              </div>
            </div>
          )}
        </>
      </div>
    </div>
  );
}
