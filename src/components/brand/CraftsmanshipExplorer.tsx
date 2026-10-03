import React, { useState } from 'react';
import { Layers, ShieldCheck, Sparkles, Check, ChevronRight, Eye, RefreshCw, ZoomIn } from 'lucide-react';

interface CraftLayer {
  id: 'textile' | 'collar' | 'print' | 'silhouette';
  number: string;
  title: string;
  subtitle: string;
  metric: string;
  description: string;
  specifications: string[];
  tag: string;
  highlightCoordinates: { x: number; y: number; label: string };
}

const LAYERS: CraftLayer[] = [
  {
    id: 'textile',
    number: '01',
    title: '340 GSM Organic French Terry Weave',
    subtitle: 'Custom Milled in Porto, Portugal',
    metric: '340 Grams / Meter² (Loopback Interior)',
    description: 'Spun from 100% GOTS-certified long-staple organic cotton. Loopback interior knitting delivers a dense, structured drape that holds its boxy architectural silhouette without clinging.',
    specifications: [
      'Pre-shrunk with gentle enzyme vintage bath',
      'Zero synthetic blend fibers — pure combed cotton',
      'Breathable interior loop structure for 4-season wear',
      'OEKO-TEX Standard 100 certified non-toxic dyes'
    ],
    tag: 'Base Textile',
    highlightCoordinates: { x: 50, y: 55, label: '340 GSM French Terry' }
  },
  {
    id: 'collar',
    number: '02',
    title: 'Anti-Stretch 1x1 Ribbed Collar',
    subtitle: 'Reinforced Twin-Needle Topstitch',
    metric: '100+ Wash Shape Retention',
    description: 'The neckline is engineered with heavy-gauge 1x1 cotton-elastane micro-ribbing and twin-needle seam lock, preventing the notorious bacon-collar sagging even after countless machine washes.',
    specifications: [
      'Twin-needle topstitch with bonded nylon core thread',
      'Interior herringbone neck-tape covering raw seam',
      'Snug luxury drape sitting flush against the clavicle',
      'Reinforced stretch recovery memory'
    ],
    tag: 'Structural Engineering',
    highlightCoordinates: { x: 50, y: 16, label: 'Anti-Stretch Collar' }
  },
  {
    id: 'print',
    number: '03',
    title: 'High-Density Baroque Screenprint',
    subtitle: 'Archival Emulsion Ink Relief',
    metric: '8-Pass Precision Screen // 0.4mm Relief',
    description: 'Our signature baroque sleeve motifs are pulled by hand using custom high-density archival ink. The resulting print possesses tactile sculptural relief with deep contrast that never cracks or peels.',
    specifications: [
      'Heat-cured at 165°C for permanent molecular fiber bonding',
      'High-solids water-based emulsion with zero formaldehyde',
      'Tactile 0.4mm raised dimensional print surface',
      'Tested against 50+ wash-dry abrasive cycles'
    ],
    tag: 'Artisanal Application',
    highlightCoordinates: { x: 80, y: 50, label: 'Baroque Sleeve Ink' }
  },
  {
    id: 'silhouette',
    number: '04',
    title: 'Double-Needle Dropped Shoulder Seams',
    subtitle: 'Architectural Ready-to-Wear Proportions',
    metric: 'Tailored Boxy Proportion',
    description: 'Cut with an intentional dropped shoulder line and widened chest dimension, tapering gently at the hem. Flatlock seam construction eliminates chafing while maintaining clean silhouette contours.',
    specifications: [
      'Reinforced shoulder seam binding prevents hanger stretch',
      'Clean blind-hem wrist cuffs designed for effortless stacking',
      'Genderless boxy luxury streetwear proportion',
      'Hand-finished by master tailors in Portugal'
    ],
    tag: 'Tailoring Architecture',
    highlightCoordinates: { x: 26, y: 28, label: 'Double-Needle Shoulder' }
  }
];

export const CraftsmanshipExplorer: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<CraftLayer>(LAYERS[0]);

  return (
    <section aria-label="Craftsmanship and Fabric Anatomy" className="bg-[#0D0D11] text-white p-6 sm:p-12 border border-white/10 relative overflow-hidden font-sans">
      
      {/* Background Architectural Grid Lines */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/10 pb-8 gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
              The Anatomy of Heavyweight Luxury // الحرفة والأقمشة
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-light uppercase tracking-wider text-white">
            340 GSM Architectural Craftsmanship
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 self-start sm:self-auto shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Portuguese Certified Mill (Porto)</span>
        </div>
      </div>

      {/* Layer Navigation Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 py-6 border-b border-white/10 relative z-10">
        {LAYERS.map((layer) => {
          const isSel = activeLayer.id === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => setActiveLayer(layer)}
              className={`p-3.5 text-left transition-all border flex flex-col justify-between ${
                isSel
                  ? 'bg-white text-black border-white shadow-xl scale-[1.01]'
                  : 'bg-white/[0.03] text-white/70 border-white/10 hover:border-white/30 hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={isSel ? 'text-black font-bold' : 'text-white/40'}>{layer.number}</span>
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 ${isSel ? 'bg-black text-white font-bold' : 'bg-white/10 text-white/60'}`}>
                  {layer.tag}
                </span>
              </div>
              <p className={`text-xs uppercase font-medium mt-3 tracking-wider ${isSel ? 'text-black font-bold' : 'text-white'}`}>
                {layer.title.split('—')[0]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Layer Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8 items-center relative z-10">
        
        {/* Left: Interactive Metric & Narrative */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 block font-semibold">
              Layer {activeLayer.number} // {activeLayer.subtitle}
            </span>
            <h3 className="text-xl sm:text-3xl font-light uppercase tracking-wide text-white">
              {activeLayer.title}
            </h3>
            <p className="text-sm font-mono text-amber-300 font-bold">
              ★ {activeLayer.metric}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-xl font-light">
            {activeLayer.description}
          </p>

          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/50 block font-bold">
              Atelier Technical Benchmark Specifications:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeLayer.specifications.map((spec, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs font-mono text-white/90 bg-white/[0.04] p-3 border border-white/10">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-snug">{spec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Interactive Graphic Visualizer / Cross-Section Canvas */}
        <div className="lg:col-span-5 bg-black/80 border border-white/20 p-6 sm:p-8 relative">
          
          <div className="flex items-center justify-between text-[10px] font-mono text-white/50 border-b border-white/10 pb-3 mb-4">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-emerald-400">
              <ZoomIn className="w-3.5 h-3.5" />
              <span>Microscope Inspection View</span>
            </span>
            <span className="uppercase tracking-widest text-white/40">Scale 20:1</span>
          </div>

          {/* Graphic Visualization depending on selected layer */}
          <div className="aspect-[4/3] bg-[#121217] border border-white/10 rounded flex items-center justify-center p-4 relative overflow-hidden">
            
            {activeLayer.id === 'textile' && (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-3 text-center">
                {/* SVG Loopback French Terry weave animation representation */}
                <svg className="w-48 h-28 text-emerald-400" viewBox="0 0 200 100" fill="none">
                  {/* Dense French Terry Loops */}
                  {[20, 50, 80, 110, 140, 170].map((cx, i) => (
                    <g key={i}>
                      <path
                        d={`M ${cx-10} 80 C ${cx-10} 20, ${cx+10} 20, ${cx+10} 80`}
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        className="animate-pulse"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                      <circle cx={cx} cy="30" r="3" fill="#F59E0B" />
                    </g>
                  ))}
                  <line x1="10" y1="82" x2="190" y2="82" stroke="white" strokeWidth="4" />
                  <line x1="10" y1="88" x2="190" y2="88" stroke="#666666" strokeWidth="2" strokeDasharray="4 4" />
                </svg>
                <div className="text-[11px] font-mono text-white/80">
                  <span className="text-emerald-400 font-bold">French Terry Loopback Architecture</span>
                  <p className="text-[10px] text-white/50">Dense 340 GSM Combed Loops • Heat Regulating</p>
                </div>
              </div>
            )}

            {activeLayer.id === 'collar' && (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-3 text-center">
                <svg className="w-48 h-28 text-white" viewBox="0 0 200 100" fill="none">
                  {/* Collar curve */}
                  <path d="M 20 30 Q 100 80 180 30" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                  {/* Twin needle stitch lines */}
                  <path d="M 22 42 Q 100 90 178 42" stroke="#10B981" strokeWidth="2" strokeDasharray="4 3" />
                  <path d="M 24 47 Q 100 95 176 47" stroke="#10B981" strokeWidth="2" strokeDasharray="4 3" />
                  {/* Vertical ribs */}
                  {[40, 60, 80, 100, 120, 140, 160].map((rx, idx) => (
                    <line key={idx} x1={rx} y1="36" x2={rx} y2="52" stroke="white" strokeWidth="1.5" />
                  ))}
                </svg>
                <div className="text-[11px] font-mono text-white/80">
                  <span className="text-amber-400 font-bold">1x1 Micro-Rib & Twin-Needle Core Lock</span>
                  <p className="text-[10px] text-white/50">Zero Collar Sagging • 100+ Wash Shape Lock</p>
                </div>
              </div>
            )}

            {activeLayer.id === 'print' && (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-3 text-center">
                <svg className="w-48 h-28" viewBox="0 0 200 100" fill="none">
                  {/* Fabric substrate */}
                  <rect x="20" y="60" width="160" height="25" fill="#1C1C24" stroke="#444" />
                  {/* Raised 0.4mm high-density ink profile */}
                  <rect x="40" y="38" width="120" height="22" rx="2" fill="#EAEAEA" stroke="#FFF" strokeWidth="1.5" />
                  <text x="100" y="53" fill="#000" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                    HIGH-DENSITY INK (0.4mm)
                  </text>
                  {/* Thermal cure bonding arrows */}
                  <line x1="60" y1="20" x2="60" y2="34" stroke="#F59E0B" strokeWidth="2" markerEnd="url(#arrow)" />
                  <line x1="100" y1="20" x2="100" y2="34" stroke="#F59E0B" strokeWidth="2" />
                  <line x1="140" y1="20" x2="140" y2="34" stroke="#F59E0B" strokeWidth="2" />
                </svg>
                <div className="text-[11px] font-mono text-white/80">
                  <span className="text-emerald-400 font-bold">Raised Tactile Baroque Ink Relief</span>
                  <p className="text-[10px] text-white/50">Heat-Cured at 165°C • Non-Cracking Flexible Polymer</p>
                </div>
              </div>
            )}

            {activeLayer.id === 'silhouette' && (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-3 text-center">
                <svg className="w-48 h-28" viewBox="0 0 200 100" fill="none">
                  {/* Dropped shoulder curve */}
                  <path d="M 30 70 L 60 30 L 140 30 L 170 70" stroke="white" strokeWidth="2" strokeDasharray="3 3" />
                  {/* Twin needle shoulder seam */}
                  <line x1="56" y1="32" x2="144" y2="32" stroke="#10B981" strokeWidth="3" />
                  <line x1="56" y1="36" x2="144" y2="36" stroke="#10B981" strokeWidth="3" />
                  {/* Twill tape interior reinforcement */}
                  <rect x="75" y="38" width="50" height="6" fill="#F59E0B" />
                </svg>
                <div className="text-[11px] font-mono text-white/80">
                  <span className="text-amber-400 font-bold">Double-Needle Dropped Shoulder Seam</span>
                  <p className="text-[10px] text-white/50">Interior Twill Tape Reinforcement • No Hanger Distortion</p>
                </div>
              </div>
            )}

          </div>

          {/* Quick Technical Specs Summary */}
          <div className="border-t border-white/10 pt-4 text-[10px] font-mono text-white/60 space-y-1.5 mt-4">
            <div className="flex justify-between">
              <span>Textile Density:</span>
              <span className="text-white font-bold">340 GSM Heavyweight</span>
            </div>
            <div className="flex justify-between">
              <span>Fiber Composition:</span>
              <span className="text-white">100% Organic Combed</span>
            </div>
            <div className="flex justify-between">
              <span>Mill Provenance:</span>
              <span className="text-white">Porto, Portugal</span>
            </div>
            <div className="flex justify-between">
              <span>Shape Longevity:</span>
              <span className="text-emerald-400 font-bold">100+ Machine Washes Verified</span>
            </div>
          </div>

        </div>

      </div>

    </section>
  );
};
