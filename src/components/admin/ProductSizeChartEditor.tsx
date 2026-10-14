import React, { useState } from 'react';
import {
  Upload,
  Check,
  RotateCcw,
  Trash2,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import type { ProductSizeChart } from '../../types/sizeChart';
import {
  DEFAULT_TSHIRT_SIZE_CHART,
  DEFAULT_TSHIRT_TEMPLATE_URL
} from '../../types/sizeChart';
import { uploadAdminMedia } from '../../lib/adminProducts';

interface ProductSizeChartEditorProps {
  value?: ProductSizeChart | null;
  onChange: (updated: ProductSizeChart) => void;
  productVariants?: Array<{ size: string }>;
  productName?: string;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ProductSizeChartEditor: React.FC<ProductSizeChartEditorProps> = ({
  value,
  onChange,
  productName = 'القطعة'
}) => {
  const chart: ProductSizeChart = value || {
    ...DEFAULT_TSHIRT_SIZE_CHART,
    enabled: true
  };

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const currentImageUrl = (chart.template_image_url || chart.image_url || '').trim();

  // Helper to trigger update preserving existing structured data
  const updateChart = (partial: Partial<ProductSizeChart>) => {
    onChange({
      ...chart,
      ...partial
    });
  };

  // Switch presets (T-Shirt, Trousers, Custom Sizing)
  const handleSelectPreset = (presetKey: 't-shirt' | 'trousers' | 'custom') => {
    if (presetKey === 't-shirt') {
      updateChart({
        category: 't-shirt',
        // Default to VB original T-shirt template if no custom image was uploaded yet
        template_image_url: chart.template_image_url || DEFAULT_TSHIRT_TEMPLATE_URL
      });
    } else if (presetKey === 'trousers') {
      updateChart({
        category: 'trousers'
      });
    } else {
      updateChart({
        category: 'custom'
      });
    }
  };

  // Image Upload with validation
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validate file type (PNG, JPG, WebP)
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const isExtensionValid = /\.(png|jpe?g|webp)$/i.test(fileName);
    if (!ALLOWED_IMAGE_TYPES.includes(fileType) && !isExtensionValid) {
      const msg = 'صيغة الملف غير مدعومة. يرجى رفع صورة بصيغة PNG أو JPG أو WebP.';
      setUploadError(msg);
      alert(msg);
      e.target.value = '';
      return;
    }

    // 2. Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const msg = 'حجم الصورة كبير جداً (أقصى حجم مسموح به هو 10 ميجابايت).';
      setUploadError(msg);
      alert(msg);
      e.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await uploadAdminMedia(file);
      if (res.url) {
        updateChart({
          template_image_url: res.url,
          image_url: res.url
        });
      } else if (res.error) {
        const msg = `فشل رفع الصورة: ${res.error}`;
        setUploadError(msg);
        alert(msg);
      }
    } catch (err: any) {
      const msg = `خطأ في الرفع: ${err.message || 'فشلت العملية'}`;
      setUploadError(msg);
      alert(msg);
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = () => {
    updateChart({
      template_image_url: '',
      image_url: ''
    });
  };

  const handleResetToDefaultTshirt = () => {
    updateChart({
      template_image_url: DEFAULT_TSHIRT_TEMPLATE_URL,
      image_url: DEFAULT_TSHIRT_TEMPLATE_URL
    });
  };

  return (
    <div className="space-y-6 text-xs text-slate-800" dir="rtl">
      {/* 1. تفعيل جدول المقاسات */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-900 block text-sm">
            تفعيل جدول المقاسات لهذه القطعة (Size Chart)
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            عند التفعيل يظهر زر (Sizechart) داخل صفحة تفاصيل المنتج بالمتجر ليتمكن المشتري من فتح صورة المخطط والقياسات.
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={chart.enabled !== false}
            onChange={(e) => updateChart({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {chart.enabled !== false && (
        <>
          {/* 2. اختيار فئة ونموذج جدول المقاسات (Category) */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-bold">
              نوع وقالب جدول المقاسات (Template Category):
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectPreset('t-shirt')}
                className={`p-3 text-right rounded-xl border transition-all cursor-pointer ${
                  chart.category === 't-shirt'
                    ? 'border-zinc-900 bg-zinc-950 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>تيشيرت / توب (T-Shirt)</span>
                  {chart.category === 't-shirt' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className={`text-[10px] mt-1 ${chart.category === 't-shirt' ? 'text-zinc-300' : 'text-slate-500'}`}>
                  مخطط التيشيرتات والقمصان العلوية
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('trousers')}
                className={`p-3 text-right rounded-xl border transition-all cursor-pointer ${
                  chart.category === 'trousers'
                    ? 'border-zinc-900 bg-zinc-950 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>بنطلون / شروال (Trousers)</span>
                  {chart.category === 'trousers' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className={`text-[10px] mt-1 ${chart.category === 'trousers' ? 'text-zinc-300' : 'text-slate-500'}`}>
                  مخطط البناطيل والشراويل والقطع السفلية
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`p-3 text-right rounded-xl border transition-all cursor-pointer ${
                  chart.category === 'custom' || (!['t-shirt', 'trousers'].includes(chart.category))
                    ? 'border-zinc-900 bg-zinc-950 text-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>مخصص (Custom Sizing)</span>
                  {chart.category === 'custom' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className={`text-[10px] mt-1 ${chart.category === 'custom' ? 'text-zinc-300' : 'text-slate-500'}`}>
                  مخطط مخصص لأي تصنيف آخر
                </div>
              </button>
            </div>
          </div>

          {/* 3. إعدادات وحدة القياس وطريقة العرض */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-slate-700 font-bold mb-1">وحدة القياس (Measurement Unit)</label>
              <select
                value={chart.unit || 'cm'}
                onChange={(e) => updateChart({ unit: e.target.value })}
                className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900 text-xs font-bold"
              >
                <option value="cm">سنتيمتر (cm) — الشائع والمعتمد</option>
                <option value="in">بوصة (in)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">طريقة العرض (Display Method)</label>
              <select
                value={chart.render_mode || 'overlay'}
                onChange={(e) => updateChart({ render_mode: e.target.value as any })}
                className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900 text-xs font-bold"
              >
                <option value="overlay">مخطط ورسم هندسي مرئي (Visual Diagram)</option>
                <option value="table">جدول قياسات مفصل ونظيف (Data Table)</option>
              </select>
              <span className="text-[10px] text-slate-500 block mt-1">
                تعرض واجهة المتجر صورة المخطط المرفوعة فقط للحفاظ على وضوح القياسات والشكل المعتمد.
              </span>
            </div>
          </div>

          {/* 4. رفع وإدارة صورة مخطط المقاسات (Image Upload) */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-xs">
                  صورة مخطط المقاسات للمنتج (Size Chart Image):
                </span>
                <span className="text-[11px] text-slate-500 block">
                  ارفع صورة المخطط التي تحتوي على كافة المقاسات والأسهم والبيانات بالصيغ المعتمدة (PNG, JPG, WebP - حد أقصى 10MB).
                </span>
              </div>
              {chart.category === 't-shirt' && (
                <button
                  type="button"
                  onClick={handleResetToDefaultTshirt}
                  className="text-[11px] text-zinc-700 hover:text-black underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة مخطط VB للتيشيرت</span>
                </button>
              )}
            </div>

            {uploadError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* معاينة الصورة المرفوعة حالياً */}
            {currentImageUrl ? (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>معاينة الصورة المعتمدة لهذه القطعة:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-md cursor-pointer transition-colors flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>{isUploadingImage ? 'جاري الرفع...' : 'استبدال الصورة'}</span>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        onChange={handleImageUpload}
                        disabled={isUploadingImage}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 text-[11px] font-bold rounded-md transition-colors flex items-center gap-1"
                      title="حذف الصورة"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center items-center bg-slate-50 p-2 border border-slate-100 rounded-lg max-h-72 overflow-hidden">
                  <img
                    src={currentImageUrl}
                    alt={`${productName} Size Chart`}
                    className="max-h-64 w-auto object-contain select-none"
                  />
                </div>

                <div className="text-[10px] text-slate-500 font-mono truncate" dir="ltr">
                  URL: {currentImageUrl}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 hover:border-zinc-500 rounded-xl p-6 text-center bg-white transition-colors">
                <div className="max-w-sm mx-auto space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-xs text-slate-900">
                    اسحب وأفلت صورة جدول المقاسات هنا أو اضغط للاختيار
                  </p>
                  <p className="text-[10px] text-slate-500">
                    يدعم PNG, JPG, WebP حتى 10 ميجابايت
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-zinc-800 transition-colors mt-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? 'جاري الرفع...' : 'رفع صورة من الجهاز'}</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* حقل إدخال الرابط يدوياً إن رغب الأدمن */}
            <div className="pt-2">
              <label className="block text-slate-600 text-[11px] mb-1">
                أو اكتب رابط الصورة المباشر:
              </label>
              <input
                type="text"
                value={currentImageUrl}
                onChange={(e) => updateChart({ template_image_url: e.target.value, image_url: e.target.value })}
                placeholder="https://... أو /assets/size-charts/tshirt-template.jpg"
                className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs font-mono text-slate-900"
                dir="ltr"
              />
            </div>
          </div>

          {/* 5. ملاحظات وتوجيهات المقاس (Fit Notes) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              ملاحظات وتوجيهات المقاس (Fit Notes) — تظهر أسفل الصورة بالمتجر:
            </label>
            <textarea
              rows={2}
              value={chart.notes || ''}
              onChange={(e) => updateChart({ notes: e.target.value })}
              placeholder="مثال: All measurements are taken flat in centimeters. Designed with a contemporary boxy fit."
              className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white"
            />
          </div>
        </>
      )}
    </div>
  );
};
