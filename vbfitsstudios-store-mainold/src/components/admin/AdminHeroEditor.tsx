import React, { useState, useEffect } from 'react';
import { fetchAllAdminHeroBanners, saveHeroBanner, deleteHeroBanner, type HeroBanner } from '../../lib/heroBanners';
import { uploadAdminMedia } from '../../lib/adminProducts';
import { Plus, Trash2, Save, MoveUp, MoveDown, Image as ImageIcon, Video, RefreshCw } from 'lucide-react';
import { AdminStaticBlocksEditor } from './AdminStaticBlocksEditor';

export const AdminHeroEditor: React.FC = () => {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    setLoading(true);
    const data = await fetchAllAdminHeroBanners();
    setBanners(data);
    setLoading(false);
  };

  const handleAddBanner = () => {
    const newBanner: HeroBanner = {
      id: `new-${Date.now()}`,
      media_type: 'image',
      media_url: '',
      season_tag: 'NEW ARRIVAL',
      title: 'New Collection',
      subtitle: 'Description here',
      cta_text: 'Shop Now',
      cta_link: '/shop',
      sort_order: banners.length,
      is_active: true
    };
    setBanners([...banners, newBanner]);
  };

  const handleChange = (id: string, field: keyof HeroBanner, value: any) => {
    setBanners(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleFileUpload = async (id: string, file: File) => {
    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4');
    const isGif = file.type === 'image/gif' || file.name.endsWith('.gif');
    const mediaType = isVideo ? 'video' : (isGif ? 'gif' : 'image');
    
    handleChange(id, 'media_type', mediaType);
    
    setSaving(`upload-${id}`);
    const res = await uploadAdminMedia(file);
    if (res.url) {
      handleChange(id, 'media_url', res.url);
      
      // Auto-save so it doesn't disappear if they forget to click save
      const banner = banners.find(b => b.id === id);
      if (banner && !id.startsWith('new-')) {
        await saveHeroBanner({ ...banner, media_url: res.url, media_type: mediaType });
      }
    } else {
      alert(res.error || 'Upload failed');
    }
    setSaving(null);
  };

  const handleSave = async (banner: HeroBanner) => {
    setSaving(banner.id);
    const res = await saveHeroBanner(banner);
    if (res.success && res.data) {
      setBanners(prev => prev.map(b => b.id === banner.id ? res.data! : b));
    } else {
      alert(res.error || 'Failed to save');
    }
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    if (!id.startsWith('new-')) {
      await deleteHeroBanner(id);
    }
    setBanners(prev => prev.filter(b => b.id !== id));
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;
    
    const newBanners = [...banners];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newBanners[index].sort_order;
    newBanners[index].sort_order = newBanners[targetIndex].sort_order;
    newBanners[targetIndex].sort_order = temp;
    
    // Sort array
    newBanners.sort((a, b) => a.sort_order - b.sort_order);
    setBanners(newBanners);
    
    // Save both
    if (!newBanners[index].id.startsWith('new-')) saveHeroBanner(newBanners[index]);
    if (!newBanners[targetIndex].id.startsWith('new-')) saveHeroBanner(newBanners[targetIndex]);
  };

  if (loading) return <div className="p-8 text-center"><RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Hero Banners Editor</h3>
          <p className="text-xs text-slate-500 mt-1">Upload images, MP4 videos, or GIFs. Media type is auto-detected.</p>
        </div>
        <button onClick={handleAddBanner} className="bg-zinc-950 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors">
          <Plus className="w-4 h-4" /> Add Banner
        </button>
      </div>

      <div className="space-y-6">
        {banners.map((banner, index) => (
          <div key={banner.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col xl:flex-row gap-8">
            
            {/* Media Preview & Upload */}
            <div className="w-full xl:w-1/3 space-y-4">
              <div className="aspect-[9/16] sm:aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
                {banner.media_url ? (
                  banner.media_type === 'video' ? (
                    <video src={banner.media_url} autoPlay muted loop className="w-full h-full object-cover" />
                  ) : (
                    <img src={banner.media_url} alt="" className="w-full h-full object-cover" />
                  )
                ) : (
                  <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" /> No Media
                  </span>
                )}
                
                {saving === `upload-${banner.id}` && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-zinc-900" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-center py-2.5 rounded-lg text-xs font-bold transition-colors border border-slate-200">
                  Upload Media (IMG/MP4/GIF)
                  <input 
                    type="file" 
                    accept="image/*,video/mp4" 
                    className="hidden" 
                    onChange={e => e.target.files?.[0] && handleFileUpload(banner.id, e.target.files[0])}
                  />
                </label>
                <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-500 uppercase flex items-center gap-1">
                  {banner.media_type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                  {banner.media_type}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="w-full xl:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">Season / Kicker Tag</label>
                <input type="text" value={banner.season_tag} onChange={e => handleChange(banner.id, 'season_tag', e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">Title</label>
                <input type="text" value={banner.title} onChange={e => handleChange(banner.id, 'title', e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">Subtitle</label>
                <textarea value={banner.subtitle} onChange={e => handleChange(banner.id, 'subtitle', e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">CTA Text</label>
                <input type="text" value={banner.cta_text} onChange={e => handleChange(banner.id, 'cta_text', e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">CTA Link</label>
                <input type="text" value={banner.cta_link} onChange={e => handleChange(banner.id, 'cta_link', e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" />
              </div>
              
              <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between pt-5 border-t border-slate-100 mt-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                    <input type="checkbox" checked={banner.is_active} onChange={e => handleChange(banner.id, 'is_active', e.target.checked)} className="rounded text-zinc-900 focus:ring-zinc-900" />
                    <span className="text-xs font-bold text-slate-700">Active</span>
                  </label>
                  <div className="w-px h-6 bg-slate-200" />
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg">
                    <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30 border-r border-slate-200"><MoveUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleMove(index, 'down')} disabled={index === banners.length - 1} className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30"><MoveDown className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button onClick={() => handleDelete(banner.id)} className="flex-1 sm:flex-none justify-center border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button onClick={() => handleSave(banner)} disabled={saving === banner.id} className="flex-1 sm:flex-none justify-center bg-zinc-900 text-white px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors disabled:opacity-70">
                    {saving === banner.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Banner
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <div className="text-center py-16 bg-slate-50 border-2 border-slate-200 rounded-2xl border-dashed">
            <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-600">No banners added yet.</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add Banner" to create your first slide.</p>
          </div>
        )}
      </div>

      <AdminStaticBlocksEditor />
    </div>
  );
};
