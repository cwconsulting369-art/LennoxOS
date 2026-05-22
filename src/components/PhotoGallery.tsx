import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Trash2, Camera, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import type { Database, Photo } from '@/lib/database';

interface PhotoGalleryProps {
  database: Database;
}

export default function PhotoGallery({ database }: PhotoGalleryProps) {
  const [facePhotos, setFacePhotos] = useState<Photo[]>([]);
  const [bodyPhotos, setBodyPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [comparePhoto, setComparePhoto] = useState<Photo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setFacePhotos(database.getPhotos('face'));
    setBodyPhotos(database.getPhotos('body'));
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'face' | 'body'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const today = new Date().toISOString().split('T')[0];
      database.savePhoto(today, type, base64, '');
      refresh();
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleDelete = (id: number) => {
    database.deletePhoto(id);
    setPhotoToDelete(null);
    refresh();
  };

  const openPhoto = (photo: Photo, allPhotos: Photo[]) => {
    setSelectedPhoto(photo);
    const idx = allPhotos.findIndex((p) => p.id === photo.id);
    if (idx < allPhotos.length - 1) {
      setComparePhoto(allPhotos[idx + 1]);
    } else {
      setComparePhoto(null);
    }
    setDialogOpen(true);
  };

  const renderPhotoGrid = (photos: Photo[], type: 'face' | 'body') => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {type === 'face' ? (
            <Camera className="w-5 h-5 text-purple-400" />
          ) : (
            <User className="w-5 h-5 text-[var(--accent)]400" />
          )}
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {type === 'face' ? 'Gesichtsfotos (Jawline)' : 'Ganzkoerperfotos'}
          </h3>
        </div>
        <span className="text-xs text-[var(--text-muted)]">{photos.length} Fotos</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
        {/* Upload Card */}
        <button
          onClick={() =>
            type === 'face'
              ? faceInputRef.current?.click()
              : bodyInputRef.current?.click()
          }
          className="flex-shrink-0 w-32 h-40 rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2 transition-all hover:border-[var(--accent)] hover:bg-[#1f1f1f] active:scale-95"
          style={{ backgroundColor: 'var(--bg-card)' }}
          type="button"
        >
          <Upload className="w-6 h-6 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Hochladen</span>
        </button>

        {/* Photo Thumbnails */}
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="flex-shrink-0 w-32 h-40 rounded-xl overflow-hidden border border-[var(--border)] relative group cursor-pointer snap-start"
            onClick={() => openPhoto(photo, photos)}
          >
            <img
              src={photo.data}
              alt={`${type} ${photo.date}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all" />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-all">
              <p className="text-xs text-white">
                {new Date(photo.date).toLocaleDateString('de-DE')}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPhotoToDelete(photo.id);
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
              type="button"
              aria-label="Foto loeschen"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ))}
      </div>

      <input
        ref={faceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'face')}
      />
      <input
        ref={bodyInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'body')}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {renderPhotoGrid(facePhotos, 'face')}
      {renderPhotoGrid(bodyPhotos, 'body')}

      {/* Photo View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedPhoto?.type === 'face' ? 'Gesichtsfoto' : 'Ganzkoerperfoto'} -{' '}
              {selectedPhoto &&
                new Date(selectedPhoto.date).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
            </DialogTitle>
          </DialogHeader>

          <div
            className={`grid gap-4 ${
              comparePhoto ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            <div className="space-y-2">
              {comparePhoto && (
                <p className="text-sm text-[var(--text-muted)] text-center font-medium">Aktuell</p>
              )}
              {selectedPhoto && (
                <img
                  src={selectedPhoto.data}
                  alt="Selected"
                  className="w-full rounded-xl border border-[var(--border)]"
                />
              )}
              {selectedPhoto?.note && (
                <p className="text-xs text-[var(--text-muted)] text-center italic">
                  &quot;{selectedPhoto.note}&quot;
                </p>
              )}
            </div>

            {comparePhoto && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-muted)] text-center font-medium">
                  Vorher (
                  {new Date(comparePhoto.date).toLocaleDateString('de-DE')})
                </p>
                <img
                  src={comparePhoto.data}
                  alt="Compare"
                  className="w-full rounded-xl border border-[var(--border)]"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={photoToDelete !== null}
        onOpenChange={() => setPhotoToDelete(null)}
      >
        <AlertDialogContent
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Foto loeschen?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Diese Aktion kann nicht rueckgaengig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[var(--border)] text-gray-300 hover:bg-[#252525]"
              onClick={() => setPhotoToDelete(null)}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() =>
                photoToDelete !== null && handleDelete(photoToDelete)
              }
            >
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
