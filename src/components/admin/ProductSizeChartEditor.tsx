import React, { useState } from 'react';
import {
  Table,
  Image as ImageIcon,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
  Eye,
  Check,
  Upload,
  Info
} from 'lucide-react';
import type {
  ProductSizeChart,
  SizeChartColumn,
  SizeChartRow
} from '../../types/sizeChart';
import {
  DEFAULT_TSHIRT_SIZE_CHART,
  DEFAULT_TROUSERS_SIZE_CHART,
  DEFAULT_TSHIRT_TEMPLATE_URL
} from '../../types/sizeChart';
import { uploadAdminMedia } from '../../lib/adminProducts';

interface ProductSizeChartEditorProps {
  value?: ProductSizeChart | null;
  onChange: (updated: ProductSizeChart) => void;
  productVariants?: Array<{ size: string }>;
  productName?: string;
}

export const ProductSizeChartEditor: React.FC<ProductSizeChartEditorProps> = ({
  value,
  onChange,
  productVariants = [],
  productName = 'القطعة'
}) => {
  // Ensure default state if undefined
  const chart: ProductSizeChart = value || {
    ...DEFAULT_TSHIRT_SIZE_CHART,
    enabled: true
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [showAddSize, setShowAddSize] = useState(false);

  // Helper to trigger update
  const updateChart = (partial: Partial<ProductSizeChart>) => {
    onChange({
      ...chart,
      ...partial
    });
  };

  // Switch presets
  const handleSelectPreset = (presetKey: 't-shirt' | 'trousers' | 'custom') => {
    if (presetKey === 't-shirt') {
      onChange({
        ...DEFAULT_TSHIRT_SIZE_CHART,
        enabled: chart.enabled
      });
    } else if (presetKey === 'trousers') {
      onChange({
        ...DEFAULT_TROUSERS_SIZE_CHART,
        enabled: chart.enabled
      });
    } else {
      updateChart({
        category: 'custom',
        render_mode: 'table'
      });
    }
  };

  // Sync size rows with current product variants
  const handleSyncWithVariants = () => {
    if (productVariants.length === 0) {
      alert('لا توجد مقاسات مضافة في تبويب (المقاسات والكميات) بعد.');
      return;
    }

    const currentRows = chart.rows || [];
    const existingSizes = new Set(currentRows.map((r) => r.size.toUpperCase()));
    const newRows: SizeChartRow[] = [...currentRows];

    productVariants.forEach((v) => {
      const sz = v.size.trim().toUpperCase();
      if (!existingSizes.has(sz)) {
        newRows.push({
          size: sz,
          measurements: {}
        });
        existingSizes.add(sz);
      }
    });

    updateChart({ rows: newRows });
  };

  // Add column
  const handleAddColumn = () => {
    if (!newColLabel.trim()) return;
    const cleanLabel = newColLabel.trim();
    const id = cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const existingIds = new Set(chart.columns.map((c) => c.id));

    if (existingIds.has(id)) {
      alert('هذا العمود موجود بالفعل.');
      return;
    }

    const updatedCols: SizeChartColumn[] = [
      ...chart.columns,
      { id, label: cleanLabel, unit: chart.unit || 'cm' }
    ];

    updateChart({ columns: updatedCols });
    setNewColLabel('');
    setShowAddCol(false);
  };

  // Remove column
  const handleRemoveColumn = (colId: string) => {
    if (chart.columns.length <= 1) {
      alert('يجب الإبقاء على قياس واحد على الأقل في الجدول.');
      return;
    }

    const updatedCols = chart.columns.filter((c) => c.id !== colId);
    const updatedRows = chart.rows.map((row) => {
      const copy = { ...row.measurements };
      delete copy[colId];
      return { ...row, measurements: copy };
    });

    updateChart({ columns: updatedCols, rows: updatedRows });
  };

  // Add row
  const handleAddRow = () => {
    if (!newSizeName.trim()) return;
    const cleanSize = newSizeName.trim().toUpperCase();
    const existing = new Set(chart.rows.map((r) => r.size.toUpperCase()));

    if (existing.has(cleanSize)) {
      alert('هذا المقاس موجود بالفعل في جدول القياسات.');
      return;
    }

    const updatedRows: SizeChartRow[] = [
      ...chart.rows,
      { size: cleanSize, measurements: {} }
    ];

    updateChart({ rows: updatedRows });
    setNewSizeName('');
    setShowAddSize(false);
  };

  // Remove row
  const handleRemoveRow = (sizeName: string) => {
    if (chart.rows.length <= 1) {
      alert('يجب الإبقاء على مقاس واحد على الأقل في الجدول.');
      return;
    }

    const updatedRows = chart.rows.filter((r) => r.size !== sizeName);
    updateChart({ rows: updatedRows });
  };

  // Update cell measurement value
  const handleCellChange = (size: string, colId: string, value: string) => {
    const updatedRows = chart.rows.map((row) => {
      if (row.size === size) {
        return {
          ...row,
          measurements: {
            ...row.measurements,
            [colId]: value
          }
        };
      }
      return row;
    });

    updateChart({ rows: updatedRows });
  };

  // Image Upload
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await uploadAdminMedia(file);
      if (res.url) {
        updateChart({ template_image_url: res.url });
      } else if (res.error) {
        alert(`فشل رفع الصورة: ${res.error}`);
      }
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'فشل الرفع'}`);
    } finally {
      setIsUploadingImage(false);
    }
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
            عند التفعيل يظهر زر (Sizechart) داخل صفحة تفاصيل المنتج بالمتجر ليتمكن المشتري من معرفة مقاسه بدقة.
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
          {/* 2. اختيار القالب الجاهز (Presets) */}
          <div className="space-y-2">
            <label className="block text-slate-700 font-bold">
              اختر نوع ونموذج جدول المقاسات المناسب للقطعة:
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
                  المخطط الهندسي المعتمد (Length / Width / Sleeve)
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
                  <span>بنطلون / شروال (Pants)</span>
                  {chart.category === 'trousers' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className={`text-[10px] mt-1 ${chart.category === 'trousers' ? 'text-zinc-300' : 'text-slate-500'}`}>
                  جدول قياسات الخصر والورك والطول والساق
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
                  تحديد أعمدة وصفوف وقياسات حرة لأي صنف
                </div>
              </button>
            </div>
          </div>

          {/* 3. إعدادات القياس والعرض */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="block text-slate-700 font-bold mb-1">وحدة القياس</label>
              <select
                value={chart.unit || 'cm'}
                onChange={(e) => updateChart({ unit: e.target.value })}
                className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900 text-xs font-bold"
              >
                <option value="cm">سنتيمتر (cm) — الشائع والمعتمد</option>
                <option value="inch">بوصة (Inches)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">طريقة العرض الافتراضية</label>
              <select
                value={chart.render_mode || 'table'}
                onChange={(e) => updateChart({ render_mode: e.target.value as any })}
                className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900 text-xs font-bold"
              >
                <option value="overlay">مخطط ورسم هندسي مرئي (Visual Diagram)</option>
                <option value="table">جدول قياسات مفصل ونظيف (Data Table)</option>
              </select>
            </div>
          </div>

          {/* 4. صورة القالب الهندسي (Template Image) */}
          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">صورة المخطط الهندسي (Technical Diagram Template):</span>
              {chart.template_image_url && (
                <button
                  type="button"
                  onClick={() => updateChart({ template_image_url: DEFAULT_TSHIRT_TEMPLATE_URL })}
                  className="text-[11px] text-zinc-700 hover:text-black underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة المخطط الأصلي لـ VB</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chart.template_image_url || ''}
                onChange={(e) => updateChart({ template_image_url: e.target.value })}
                placeholder="رابط صورة المخطط (مثال: /assets/size-charts/tshirt-template.jpg)"
                className="flex-1 bg-white border border-slate-300 p-2 rounded-lg text-xs font-mono text-slate-900"
              />

              <label className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingImage ? 'جاري الرفع...' : 'رفع صورة'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleTemplateUpload}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-500">
              صورة التيشرت الأصلية محفوظة ومدمجة برابط: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">/assets/size-charts/tshirt-template.jpg</code>
            </p>
          </div>

          {/* 5. جدول إدخال وتعديل القياسات */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  جدول قياسات المقاسات (المقاسات والأبعاد بالـ {chart.unit || 'cm'}):
                </span>
                <button
                  type="button"
                  onClick={handleSyncWithVariants}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 px-2.5 py-1 rounded-md font-bold cursor-pointer"
                  title="مزامنة المقاسات مع المقاسات المضافة في التبويب 2"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>مزامنة المقاسات مع المتغيرات</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCol(!showAddCol)}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-900 bg-white border border-slate-300 hover:bg-slate-50 px-2 py-1 rounded-md font-bold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة قياس جديد (عمود)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddSize(!showAddSize)}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-900 bg-white border border-slate-300 hover:bg-slate-50 px-2 py-1 rounded-md font-bold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>إضافة مقاس (صف)</span>
                </button>
              </div>
            </div>

            {/* مربع إضافة عمود جديد */}
            {showAddCol && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="اسم القياس الجديد بالإنجليزية (مثال: Chest أو Shoulder أو Inseam)"
                  className="flex-1 bg-white border border-zinc-300 p-2 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="px-3 py-2 bg-zinc-900 text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-zinc-800"
                >
                  إضافة العمود
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCol(false)}
                  className="px-2.5 py-2 text-slate-500 hover:text-slate-800 text-xs"
                >
                  إلغاء
                </button>
              </div>
            )}

            {/* مربع إضافة مقاس جديد */}
            {showAddSize && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  value={newSizeName}
                  onChange={(e) => setNewSizeName(e.target.value)}
                  placeholder="اسم المقاس (مثال: XXL أو 3XL أو Oversized)"
                  className="flex-1 bg-white border border-zinc-300 p-2 rounded-lg text-xs font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-2 bg-zinc-900 text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-zinc-800"
                >
                  إضافة المقاس
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSize(false)}
                  className="px-2.5 py-2 text-slate-500 hover:text-slate-800 text-xs"
                >
                  إلغاء
                </button>
              </div>
            )}

            {/* جدول إدخال القيم */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-2.5 px-3 border-l border-slate-200 w-24">المقاس (Size)</th>
                    {chart.columns.map((col) => (
                      <th key={col.id} className="py-2.5 px-3 border-l border-slate-200 min-w-[110px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{col.label}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(col.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                            title={`حذف عمود ${col.label}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-2 w-12 text-slate-400">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {chart.rows.map((row) => (
                    <tr key={row.size} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 border-l border-slate-200 font-mono font-extrabold text-slate-900 bg-slate-50/50">
                        {row.size}
                      </td>
                      {chart.columns.map((col) => (
                        <td key={col.id} className="py-2 px-2 border-l border-slate-200">
                          <input
                            type="text"
                            value={row.measurements[col.id] ?? ''}
                            onChange={(e) => handleCellChange(row.size, col.id, e.target.value)}
                            placeholder="0"
                            className="w-full bg-white border border-slate-200 focus:border-zinc-900 rounded p-1.5 text-center font-mono font-bold text-slate-900 text-xs shadow-2xs"
                          />
                        </td>
                      ))}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.size)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title={`حذف مقاس ${row.size}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. ملاحظات القصة والقياس (Fit Notes) */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              ملاحظات وتوجيهات المقاس (Fit Notes):
            </label>
            <textarea
              rows={2}
              value={chart.notes || ''}
              onChange={(e) => updateChart({ notes: e.target.value })}
              placeholder="مثال: All measurements are taken flat in centimeters. Designed with a contemporary boxy fit."
              className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-zinc-900 focus:bg-white"
            />
          </div>

          {/* 7. معاينة فورية داخل لوحة التحكم */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4 text-slate-600" />
              <span>{previewOpen ? 'إخفاء المعاينة الحية' : 'معاينة شكل جدول المقاسات كما يراه المشتري'}</span>
            </button>

            {previewOpen && (
              <div className="mt-4 p-5 bg-white border border-slate-300 rounded-xl shadow-md space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 text-xs">معاينة مباشرة لحساب المشتري:</span>
                  <span className="text-[10px] text-slate-500 font-mono">VB FITS STUDIOS PREVIEW</span>
                </div>

                {chart.template_image_url && (
                  <div className="relative mx-auto max-w-[360px] bg-white border border-slate-200 shadow-2xs select-none">
                    <img
                      src={chart.template_image_url}
                      alt="Preview template"
                      className="w-full h-auto block"
                    />
                    {chart.rows.map((row) => {
                      const y = chart.layout?.rowY?.[row.size];
                      if (y === undefined) return null;
                      return chart.columns.map((col) => {
                        const x = chart.layout?.colX?.[col.id];
                        if (x === undefined) return null;
                        const val = row.measurements[col.id];
                        if (val === undefined || val === '') return null;
                        return (
                          <div
                            key={`preview-${row.size}-${col.id}`}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 text-[10px] sm:text-[11px] font-bold text-black font-mono text-center pointer-events-none"
                            style={{ left: `${x}%`, top: `${y}%` }}
                          >
                            {val}
                          </div>
                        );
                      });
                    })}
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-200">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold">
                        <th className="py-2 px-3 border-r border-slate-200">Size</th>
                        {chart.columns.map((c) => (
                          <th key={c.id} className="py-2 px-3">
                            {c.label} ({chart.unit || 'cm'})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {chart.rows.map((r) => (
                        <tr key={r.size}>
                          <td className="py-2 px-3 font-bold border-r border-slate-200 bg-slate-50/50">
                            {r.size}
                          </td>
                          {chart.columns.map((c) => (
                            <td key={c.id} className="py-2 px-3">
                              {r.measurements[c.id] || '—'} {chart.unit || 'cm'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  {chart.notes}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
