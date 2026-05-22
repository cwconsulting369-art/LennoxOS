import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AddExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, color: string) => void;
}

const PRESET_COLORS = [
  'var(--accent)', '#00bcd4', '#ff9100', '#e91e63',
  '#9c27b0', '#3f51b5', '#ff5722', '#4caf50',
  '#ffc107', '#795548', '#607d8b', '#f44336',
];

export default function AddExerciseDialog({
  open,
  onOpenChange,
  onAdd,
}: AddExerciseDialogProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Bitte einen Namen eingeben');
      return;
    }
    if (trimmed.length > 40) {
      setError('Name darf maximal 40 Zeichen lang sein');
      return;
    }
    setError('');
    onAdd(trimmed, selectedColor);
    setName('');
    setSelectedColor(PRESET_COLORS[0]);
    onOpenChange(false);
  };

  const handleClose = () => {
    setName('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-white">Neue Uebung</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-[var(--text-muted)] mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder="z.B. Klimmzuege"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] text-white text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              style={{ backgroundColor: 'var(--bg-page)' }}
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-400 mt-1">{error}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-[var(--text-muted)] mb-2 block">Farbe</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className="w-8 h-8 rounded-full border-2 transition-all active:scale-90"
                  style={{
                    backgroundColor: color,
                    borderColor:
                      selectedColor === color ? '#f5f5f5' : 'transparent',
                    transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                  }}
                  type="button"
                  aria-label={`Farbe ${color} auswaehlen`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-gray-300 text-sm transition-all hover:bg-[#252525]"
            type="button"
          >
            Abbrechen
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)' }}
            type="button"
          >
            Hinzufuegen
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
