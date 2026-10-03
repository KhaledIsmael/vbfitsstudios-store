import React, { useState } from 'react';
import { Package, Award, Sparkles, Feather, ShieldCheck, Check, Box, HeartHandshake } from 'lucide-react';

interface PackagingStep {
  step: string;
  icon: any;
  title: string;
  spec: string;
  detail: string;
  visualTag: string;
}

const PACKAGING_STEPS: PackagingStep[] = [
  {
    step: '01',
    icon: Package,
    title: 'Matte Obsidian Presentation Box',
    spec: '1,200 GSM Rigid Recycled Board',
    detail: 'Constructed from heavy 1,200 GSM architectural board with a velvet-touch matte obsidian exterior, blind-embossed with the VB Fits Studios insignia and secured with magnetic closure.',
    visualTag: 'Outer Rigid Armor'
  },
  {
    step: '02',
    icon: Feather,
    title: 'Acid-Free Archival Silk Paper',
    spec: '28 GSM Translucent Tissue Wrapping',
    detail: 'Every garment is delicately hand-folded and enveloped in pH-neutral, acid-free translucent tissue to shield heavyweight organic cotton fibers from atmospheric humidity.',
    visualTag: 'Fiber Shielding'
  },
  {
    step: '03',
    icon: Sparkles,
    title: 'Artisanal Wax Monogram Seal',
    spec: 'Hand-Stamped Portuguese Atelier Wax',
    detail: 'The tissue folds are sealed with a bespoke midnight black wax impression bearing the atelier crest — assuring untouchable first-hand provenance directly from Portugal.',
    visualTag: 'Tamperproof Heritage Seal'
  },
  {
    step: '04',
    icon: Award,
    title: 'Numbered Certificate of Origin',
    spec: 'Gold Foil Letterpress on 600 GSM Card',
    detail: 'Accompanied by a heavy foil-stamped authenticity card bearing your unique garment serial number, batch run, and Porto QC inspector signature, syncable with /verify.',
    visualTag: 'Physical Proof of Provenance'
  }
];

export const PackagingVisualizer: React.FC = () => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeItem = PACKAGING_STEPS[selectedIdx];

  return (
    <section aria-label="Bespoke Packaging and Unboxing Visualizer" className="border-2 border-black bg-white p-6 sm:p-12 my-12 shadow-xl font-sans relative overflow-hidden">
      
      {/* Editorial Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-[10px] uppercase font-mono tracking-widest">
          <Box className="w-3.5 h-3.5 text-amber-300" />
          <span>The Atelier Unboxing Standard // طريقة وصول الشحنة الفاخرة</span>
        </div>
        <h3 className="text-2xl sm:text-4xl font-light uppercase tracking-wider text-black">
          Bespoke Presentation & Packaging
        </h3>
        <p className="text-xs sm:text-sm text-[#666666] leading-relaxed font-light">
          We believe the acquisition experience begins the moment the parcel arrives. Every garment is preserved in our signature museum-grade presentation box — curated for collectors and connoisseurs.
        </p>
      </div>

      {/* Interactive Unboxing Visual Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center mb-8 bg-[#FAFAFA] border border-[#EAEAEA] p-6 sm:p-8">
        
        {/* Left: Graphic Unboxing Vignette */}
        <div className="lg:col-span-6 bg-black text-white p-6 sm:p-8 aspect-[16/10] flex flex-col justify-between relative overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between text-[10px] font-mono text-white/50 border-b border-white/10 pb-3">
            <span className="text-amber-400 font-bold uppercase tracking-wider">Unboxing Layer {activeItem.step} of 04</span>
            <span className="uppercase tracking-widest">{activeItem.visualTag}</span>
          </div>

          <div className="my-auto space-y-2 text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full border border-amber-400/40 bg-white/5 flex items-center justify-center relative">
              <activeItem.icon className="w-8 h-8 text-amber-300 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            </div>

            <h4 className="text-lg sm:text-xl font-light uppercase tracking-wider text-white pt-2">
              {activeItem.title}
            </h4>
            <p className="text-xs font-mono text-emerald-400">
              {activeItem.spec}
            </p>
          </div>

          <div className="text-[10px] font-mono text-white/40 flex items-center justify-between border-t border-white/10 pt-2.5">
            <span>VB FITS STUDIOS — PORTO ATELIER</span>
            <span className="text-white/80">COMPLIMENTARY PRESENTATION</span>
          </div>
        </div>

        {/* Right: Layer Description & Craftsmanship Details */}
        <div className="lg:col-span-6 space-y-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#888888] block">
            Step {activeItem.step} // Material Engineering
          </span>
          <h4 className="text-xl sm:text-2xl font-light uppercase tracking-wide text-black">
            {activeItem.title}
          </h4>
          <p className="text-xs sm:text-sm text-[#555555] leading-relaxed">
            {activeItem.detail}
          </p>

          <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono">
            <span className="px-2.5 py-1 bg-black text-white uppercase font-bold">
              ✓ 100% Recyclable FSC Board
            </span>
            <span className="px-2.5 py-1 bg-white border border-[#CCCCCC] text-black uppercase font-bold">
              ✓ Acid-Free Archival Grade
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 uppercase font-bold">
              ✓ Serialized QC Card Included
            </span>
          </div>
        </div>

      </div>

      {/* 4-Step Packaging Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {PACKAGING_STEPS.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`p-4 sm:p-5 border text-left transition-all ${
                isSelected
                  ? 'border-2 border-black bg-black text-white shadow-lg -translate-y-1'
                  : 'border-[#EAEAEA] bg-white text-black hover:border-black hover:bg-[#FAFAFA]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-amber-300' : 'text-[#888888]'}`}>
                  {item.step}
                </span>
                <div className={`p-1.5 rounded-full ${isSelected ? 'bg-white/10 text-white' : 'bg-[#F2F2F2] text-black'}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <h5 className="text-xs font-semibold uppercase tracking-wider mb-1 truncate">
                {item.title}
              </h5>
              <p className={`text-[10px] line-clamp-2 leading-relaxed ${isSelected ? 'text-white/70' : 'text-[#666666]'}`}>
                {item.spec}
              </p>
            </button>
          );
        })}
      </div>

      {/* Assurance Footer */}
      <div className="mt-8 pt-6 border-t border-[#EAEAEA] flex flex-col sm:flex-row items-center justify-between text-xs text-[#777777] font-mono gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Bespoke presentation box included complimentary with every order</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[#999999]">
          Perfect for luxury gifting or personal preservation
        </span>
      </div>

    </section>
  );
};
