import { useState, useCallback, useEffect, useRef } from 'react';
import { Trash2, Plus, Download, Upload, AlertTriangle, Palette } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import AddExerciseDialog from './AddExerciseDialog';
import type { Database, UserExercise } from '@/lib/database';

interface SettingsPanelProps {
  database: Database;
  refreshKey: number;
}

export default function SettingsPanel({ database, refreshKey }: SettingsPanelProps) {
  const [exercises, setExercises] = useState<UserExercise[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [waterGoal, setWaterGoal] = useState(2.5);
  const [sleepGoal, setSleepGoal] = useState(7.5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setExercises(database.getUserExercises());
    const today = new Date().toISOString().split('T')[0];
    const waterLog = database.getWaterLog(today);
    const sleepLog = database.getSleepLog(today);
    setWaterGoal(waterLog.goal);
    setSleepGoal(sleepLog.goal);
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleAddExercise = (name: string, color: string) => {
    database.addUserExercise(name, color);
    refresh();
  };

  const handleDeleteExercise = (id: number) => {
    database.deleteUserExercise(id);
    refresh();
  };

  const handleWaterGoalChange = (value: number[]) => {
    const goal = value[0];
    setWaterGoal(goal);
    const today = new Date().toISOString().split('T')[0];
    database.setWaterGoal(today, goal);
  };

  const handleSleepGoalChange = (value: number[]) => {
    const goal = value[0];
    setSleepGoal(goal);
    const today = new Date().toISOString().split('T')[0];
    database.setSleepGoal(today, goal);
  };

  const handleExport = () => {
    const data = database.exportDatabase();
    const blob = new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-backup-${new Date().toISOString().split('T')[0]}.db`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const uint8 = new Uint8Array(arrayBuffer);
      database.importDatabase(uint8);
      window.location.reload();
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleReset = () => {
    database.resetAllData();
    setResetDialogOpen(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Exercise Management */}
      <div
        className="rounded-xl border border-[var(--border)] p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Uebungen verwalten
            </h3>
          </div>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)' }}
            type="button"
          >
            <Plus className="w-3.5 h-3.5" />
            Neue Uebung
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {exercises.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-page)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ex.color }}
                />
                <span className="text-sm text-gray-200">{ex.name}</span>
                {ex.isDefault && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text-muted)]">
                    Standard
                  </span>
                )}
              </div>
              {!ex.isDefault && (
                <button
                  onClick={() => handleDeleteExercise(ex.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20"
                  type="button"
                  aria-label="Uebung loeschen"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div
        className="rounded-xl border border-[var(--border)] p-5 space-y-5"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Ziele einstellen
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Wasser-Ziel</span>
            <span className="text-sm font-bold text-blue-400">
              {waterGoal.toFixed(1)} L
            </span>
          </div>
          <Slider
            value={[waterGoal]}
            onValueChange={handleWaterGoalChange}
            min={1.5}
            max={5}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>1.5 L</span>
            <span>5 L</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Schlaf-Ziel</span>
            <span className="text-sm font-bold text-indigo-400">
              {sleepGoal.toFixed(1)} h
            </span>
          </div>
          <Slider
            value={[sleepGoal]}
            onValueChange={handleSleepGoalChange}
            min={5}
            max={10}
            step={0.5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[var(--text-muted)]">
            <span>5 h</span>
            <span>10 h</span>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div
        className="rounded-xl border border-[var(--border)] p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Daten
        </h3>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-gray-300 text-sm transition-all hover:bg-[#252525] active:scale-95"
            type="button"
          >
            <Download className="w-4 h-4 text-[var(--accent)]" />
            Exportieren
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-gray-300 text-sm transition-all hover:bg-[#252525] active:scale-95"
            type="button"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            Importieren
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,application/octet-stream"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        <button
          onClick={() => setResetDialogOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-red-400 text-sm transition-all hover:bg-red-500/10 active:scale-95"
          type="button"
        >
          <AlertTriangle className="w-4 h-4" />
          Alle Daten loeschen
        </button>
      </div>

      {/* Add Exercise Dialog */}
      <AddExerciseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAddExercise}
      />

      {/* Reset Confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Alle Daten loeschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Diese Aktion loescht ALLE deine Daten unwiderruflich. Ein Backup wurde empfohlen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[var(--border)] text-gray-300 hover:bg-[#252525]"
              onClick={() => setResetDialogOpen(false)}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleReset}
            >
              Alles loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
