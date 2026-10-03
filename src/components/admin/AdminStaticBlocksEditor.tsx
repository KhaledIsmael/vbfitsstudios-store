import React, { useState, useEffect } from 'react';
import { getSiteSettings, updateSiteSettings, type SiteSettings, DEFAULT_SITE_SETTINGS } from '../../lib/siteSettings';
import { uploadAdminMedia } from '../../lib/adminProducts';
import { Save, Image as ImageIcon, Video, RefreshCw, Link as LinkIcon } from 'lucide-react';

export const AdminStaticBlocksEditor: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getSiteSettings().then(data => {
      if (data) setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleFileUpload = async (field: 'editorial' | 'social_proof', file: File) => {
    const isVideo = file.type.startsWith('video/') || file.name.endsWith('.mp4');
    const isGif = file.type === 'image/gif' || file.name.endsWith('.gif');
    const mediaType = isVideo ? 'video' : (isGif ? 'gif' : 'image');
    
    const typeField = field === 'editorial' ? 'editorial_media_type' : 'social_proof_media_type';
    const urlField = field === 'editorial' ? 'editorial_media_url' : 'social_proof_media_url';

    setSettings(prev => ({ ...prev, [typeField]: mediaType }));
    
    setSaving(`upload-${field}`);
    const res = await uploadAdminMedia(file);
    if (res.url) {
      setSettings(prev => ({ ...prev, [urlField]: res.url }));
    } else {
      alert(res.error || 'Upload failed');
    }
    setSaving(null);
  };

  const handleSave = async (field: 'editorial' | 'social_proof') => {
    setSaving(`save-${field}`);
    await updateSiteSettings(settings);
    setTimeout(() => setSaving(null), 1000);
  };

  if (loading) return null;

  return (
    <div className="space-y-6 mt-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">Static Homepage Blocks</h3>
          <p className="text-xs text-slate-500 mt-1">Manage single-image/video sections like the Editorial Block or Social Proof Strip.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Editorial Block */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-slate-900">Shoppable Editorial Photo</h4>
            <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              {settings.editorial_media_type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
              {settings.editorial_media_type || 'image'}
            </div>
          </div>
          <div className="aspect-[4/5] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
            {settings.editorial_media_url ? (
              settings.editorial_media_type === 'video' ? (
                <video src={settings.editorial_media_url} autoPlay muted loop className="w-full h-full object-cover" />
              ) : (
                <img src={settings.editorial_media_url} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Default Image
              </span>
            )}
            
            {saving === `upload-editorial` && (
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
                onChange={e => e.target.files?.[0] && handleFileUpload('editorial', e.target.files[0])}
              />
            </label>
            <button onClick={() => handleSave('editorial')} disabled={saving === 'save-editorial'} className="bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors disabled:opacity-70">
              {saving === 'save-editorial' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>

        {/* Social Proof Strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-slate-900">Social Proof Strip</h4>
            <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
              {settings.social_proof_media_type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
              {settings.social_proof_media_type || 'image'}
            </div>
          </div>
          <div className="aspect-[4/5] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
            {settings.social_proof_media_url ? (
              settings.social_proof_media_type === 'video' ? (
                <video src={settings.social_proof_media_url} autoPlay muted loop className="w-full h-full object-cover" />
              ) : (
                <img src={settings.social_proof_media_url} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Default Image
              </span>
            )}
            
            {saving === `upload-social_proof` && (
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
                onChange={e => e.target.files?.[0] && handleFileUpload('social_proof', e.target.files[0])}
              />
            </label>
            <button onClick={() => handleSave('social_proof')} disabled={saving === 'save-social_proof'} className="bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors disabled:opacity-70">
              {saving === 'save-social_proof' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>

      </div>

      {/* Social URLs Editor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs mt-6 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-sm text-slate-900">Social Media Links</h4>
          <button onClick={() => handleSave('social_proof')} disabled={saving === 'save-social_proof'} className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors disabled:opacity-70">
            {saving === 'save-social_proof' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Links
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> WhatsApp URL</label>
            <input 
              type="text" 
              value={settings.social_whatsapp_url || ''} 
              onChange={e => setSettings(prev => ({ ...prev, social_whatsapp_url: e.target.value }))}
              placeholder="https://wa.me/..."
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Instagram URL</label>
            <input 
              type="text" 
              value={settings.social_instagram_url || ''} 
              onChange={e => setSettings(prev => ({ ...prev, social_instagram_url: e.target.value }))}
              placeholder="https://instagram.com/..."
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase flex items-center gap-1"><LinkIcon className="w-3 h-3"/> TikTok URL</label>
            <input 
              type="text" 
              value={settings.social_tiktok_url || ''} 
              onChange={e => setSettings(prev => ({ ...prev, social_tiktok_url: e.target.value }))}
              placeholder="https://tiktok.com/..."
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
            />
          </div>
        </div>
      </div>

      {/* Credits Editor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs mt-6 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-sm text-slate-900">Footer Credits</h4>
          <button onClick={() => handleSave('social_proof')} disabled={saving === 'save-social_proof'} className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors disabled:opacity-70">
            {saving === 'save-social_proof' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Credits
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold text-slate-700 uppercase">Developer</h5>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase">Name</label>
              <input 
                type="text" 
                value={settings.credits_developer_name || ''} 
                onChange={e => setSettings(prev => ({ ...prev, credits_developer_name: e.target.value }))}
                placeholder="Khaled Ismail"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase">URL</label>
              <input 
                type="text" 
                value={settings.credits_developer_url || ''} 
                onChange={e => setSettings(prev => ({ ...prev, credits_developer_url: e.target.value }))}
                placeholder="https://linkedin.com/in/..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
              />
            </div>
          </div>
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold text-slate-700 uppercase">Agency</h5>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase">Name</label>
              <input 
                type="text" 
                value={settings.credits_agency_name || ''} 
                onChange={e => setSettings(prev => ({ ...prev, credits_agency_name: e.target.value }))}
                placeholder="ERTH"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1 uppercase">URL</label>
              <input 
                type="text" 
                value={settings.credits_agency_url || ''} 
                onChange={e => setSettings(prev => ({ ...prev, credits_agency_url: e.target.value }))}
                placeholder="https://linkedin.com/company/..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-zinc-900 focus:border-zinc-900" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
