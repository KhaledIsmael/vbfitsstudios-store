import React, { useState, useRef } from 'react';
import { AdminProductImage, uploadAdminMedia } from '../../lib/adminProducts';
import { Upload, X, Star, GripVertical, Play, Film, Image as ImageIcon, Loader2 } from 'lucide-react';

interface MediaUploaderProps {
  images: AdminProductImage[];
  onChange: (images: AdminProductImage[]) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ images, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newMediaItems: AdminProductImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { url } = await uploadAdminMedia(file);
      if (url) {
        const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4');
        const isGif = file.type === 'image/gif' || file.name.endsWith('.gif');
        newMediaItems.push({
          url,
          alt_text: file.name,
          display_order: images.length + newMediaItems.length,
          is_primary: images.length === 0 && newMediaItems.length === 0,
          media_type: isVideo ? 'video' : isGif ? 'gif' : 'image'
        });
      }
    }

    onChange([...images, ...newMediaItems]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const trimmed = urlInput.trim();
    const isVideo = trimmed.endsWith('.mp4');
    const isGif = trimmed.endsWith('.gif');

    const newItem: AdminProductImage = {
      url: trimmed,
      display_order: images.length,
      is_primary: images.length === 0,
      media_type: isVideo ? 'video' : isGif ? 'gif' : 'image'
    };

    onChange([...images, newItem]);
    setUrlInput('');
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // Re-index display_order and make sure first item is primary if needed
    const reindexed = updated.map((item, idx) => ({
      ...item,
      display_order: idx,
      is_primary: idx === 0 ? true : item.is_primary && idx !== 0 ? false : item.is_primary
    }));
    onChange(reindexed);
  };

  const handleSetPrimary = (index: number) => {
    const target = images[index];
    const withoutTarget = images.filter((_, i) => i !== index);
    const reordered = [target, ...withoutTarget].map((img, idx) => ({
      ...img,
      display_order: idx,
      is_primary: idx === 0
    }));
    onChange(reordered);
  };

  // ── Drag to Reorder HTML5 Handlers ──────────────────────────────────────────
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const items = [...images];
    const [movedItem] = items.splice(draggedIndex, 1);
    items.splice(index, 0, movedItem);

    const reindexed = items.map((img, idx) => ({
      ...img,
      display_order: idx,
      is_primary: idx === 0
    }));

    onChange(reindexed);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-[10px] font-mono uppercase tracking-widest text-white/60">
          Media Assets ({images.length} added · Drag to reorder)
        </label>
        <span className="text-[10px] font-mono text-white/40">
          First item is primary cover thumbnail
        </span>
      </div>

      {/* Drag & Drop Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed border-white/15 hover:border-white/40 transition-colors p-6 sm:p-8 text-center cursor-pointer bg-[#151519] flex flex-col items-center justify-center gap-2 group ${
          uploading ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*,video/mp4"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center gap-2 text-white text-xs font-mono">
            <Loader2 className="w-5 h-5 animate-spin text-white/70" />
            <span>Uploading to Supabase Storage...</span>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 group-hover:text-white transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs text-white/80 font-medium">
              Click to select or drag & drop luxury campaign photos / video
            </p>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              JPG, PNG, WEBP, GIF, or MP4 video (Autoplays muted on PDP)
            </p>
          </>
        )}
      </div>

      {/* Manual URL entry fallback */}
      <form onSubmit={handleAddUrl} className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Or paste direct image URL (https://...)"
          className="flex-1 bg-[#18181D] border border-white/15 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white"
        />
        <button
          type="submit"
          className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-xs uppercase tracking-wider font-mono border border-white/15"
        >
          Add URL
        </button>
      </form>

      {/* Drag to Reorder Thumbnail Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
          {images.map((img, idx) => {
            const isDragging = draggedIndex === idx;
            const isOver = dragOverIndex === idx;

            return (
              <div
                key={img.id || `${img.url}-${idx}`}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                className={`relative group bg-[#18181D] border transition-all duration-200 aspect-[3/4] flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing ${
                  isDragging
                    ? 'opacity-30 scale-95 border-dashed border-white'
                    : isOver
                    ? 'border-white ring-2 ring-white/50 scale-105'
                    : img.is_primary
                    ? 'border-amber-400/80 shadow-lg'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                {/* Media Preview */}
                <div className="w-full h-full bg-[#FAFAFA] flex items-center justify-center p-2">
                  {img.media_type === 'video' ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black/90">
                      <Play className="w-6 h-6 text-white opacity-80" />
                      <span className="absolute bottom-1 right-1 bg-black text-white text-[8px] font-mono px-1">
                        MP4
                      </span>
                    </div>
                  ) : (
                    <img
                      src={img.url}
                      alt={`Asset ${idx + 1}`}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  )}
                </div>

                {/* Top status bar on card */}
                <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between z-10">
                  {/* Primary badge */}
                  {img.is_primary ? (
                    <span className="inline-flex items-center gap-1 bg-amber-400 text-black text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 font-bold shadow">
                      <Star className="w-2.5 h-2.5 fill-black" />
                      Cover
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      title="Set as primary cover"
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-black text-white p-1 text-[8px]"
                    >
                      <Star className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    title="Remove asset"
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-red-600 text-white p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Bottom handle and order index */}
                <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-sm px-2 py-1 flex items-center justify-between text-[9px] font-mono text-white/70">
                  <span className="flex items-center gap-1">
                    <GripVertical className="w-2.5 h-2.5 opacity-50" />
                    #{idx + 1}
                  </span>
                  <span className="uppercase text-[8px] text-white/50">
                    {img.media_type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
