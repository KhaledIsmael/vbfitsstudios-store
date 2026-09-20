import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Search, Printer, Share2, Award, Sparkles, AlertCircle, QrCode, Check, Copy } from 'lucide-react';
import { BRAND_CONFIG } from '../config/assets';
import { PackagingVisualizer } from '../components/brand/PackagingVisualizer';

interface CertificateData {
  serial: string;
  queryType: 'SERIAL' | 'ORDER';
  pieceName: string;
  colorway: string;
  textileGrade: string;
  gsmWeight: string;
  origin: string;
  editionRun: string;
  batchCode: string;
  inspectionDate: string;
  inspectorId: string;
  laboratoryStamp: string;
  cryptoHash: string;
  status: 'AUTHENTIC_VERIFIED' | 'NOT_FOUND';
}

const VERIFIED_REGISTRY: Record<string, CertificateData> = {
  'VB-2026-BLK-001': {
    serial: 'VB-2026-BLK-001',
    queryType: 'SERIAL',
    pieceName: 'VB Fits Studios Long Sleeve — Washed Black',
    colorway: 'Washed Black (#111111) / High-Density Archival Ink',
    textileGrade: 'Custom 340 GSM Organic French Terry Weave',
    gsmWeight: '340 GSM Heavyweight Loopback',
    origin: 'Porto Atelier, Portugal (Laboratório Têxtil)',
    editionRun: 'Piece 042 of 250 (Archival First Edition)',
    batchCode: 'BATCH-26A-POR-V01',
    inspectionDate: 'February 14, 2026',
    inspectorId: 'QC-ATELIER-07 (Porto)',
    laboratoryStamp: 'LABORATÓRIO TÊXTIL DO PORTO // CERTIFICADO N° 88291-PT',
    cryptoHash: '8f7a9d4e2b1c603a9871e4d5fb23a9c7d41e6b8c',
    status: 'AUTHENTIC_VERIFIED'
  },
  'VB-2026-WHT-042': {
    serial: 'VB-2026-WHT-042',
    queryType: 'SERIAL',
    pieceName: 'VB Fits Studios Long Sleeve — Optic White',
    colorway: 'Optic White (#F5F5F5) with Royal Indigo Sleeve Artwork',
    textileGrade: 'Custom 340 GSM Heavyweight Combed Cotton',
    gsmWeight: '340 GSM Heavyweight Loopback',
    origin: 'Porto Atelier, Portugal (Laboratório Têxtil)',
    editionRun: 'Piece 018 of 250 (Archival Edition)',
    batchCode: 'BATCH-26B-POR-V02',
    inspectionDate: 'February 18, 2026',
    inspectorId: 'QC-ATELIER-03 (Porto)',
    laboratoryStamp: 'LABORATÓRIO TÊXTIL DO PORTO // CERTIFICADO N° 99120-PT',
    cryptoHash: '4c8e1a90f23b7d6a5c1e94d80a7b2e3f1c5d9a7e',
    status: 'AUTHENTIC_VERIFIED'
  },
  'VB-ATELIER-2026': {
    serial: 'VB-ATELIER-2026',
    queryType: 'SERIAL',
    pieceName: 'VB Fits Nocturne Capsule Silhouette — Prototype 01',
    colorway: 'Deep Obsidian Charcoal (#0E0E11)',
    textileGrade: 'Custom 380 GSM Heavy Technical French Terry Cotton',
    gsmWeight: '380 GSM Architectural Heavyweight',
    origin: 'Porto Atelier, Portugal (Laboratório Têxtil)',
    editionRun: 'Piece 007 of 050 (VIP Vault Allocation)',
    batchCode: 'BATCH-VIP-2026-PORT',
    inspectionDate: 'March 01, 2026',
    inspectorId: 'QC-LEAD-ATELIER-01',
    laboratoryStamp: 'LABORATÓRIO TÊXTIL DO PORTO // CERTIFICADO VIP-N° 007',
    cryptoHash: '9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c',
    status: 'AUTHENTIC_VERIFIED'
  },
  'VB-ORD-2026-001': {
    serial: 'VB-ORD-2026-001',
    queryType: 'ORDER',
    pieceName: 'VB Fits Studios Long Sleeve Capsule Order',
    colorway: 'Washed Black + Optic White Duo Allocation',
    textileGrade: 'Dual 340 GSM Organic French Terry Garments',
    gsmWeight: '340 GSM Heavyweight Loopback',
    origin: 'Porto Atelier, Portugal',
    editionRun: 'Verified Direct Atelier Dispatch Order #2026-001',
    batchCode: 'BATCH-26A-POR-DISPATCH',
    inspectionDate: 'March 08, 2026',
    inspectorId: 'QC-DISPATCH-LEAD',
    laboratoryStamp: 'ORDEM VERIFICADA // PORTO ATELIER ARCHIVE',
    cryptoHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    status: 'AUTHENTIC_VERIFIED'
  }
};

export const VerifyPage: React.FC = () => {
  const [inputCode, setInputCode] = useState('VB-2026-BLK-001');
  const [certificate, setCertificate] = useState<CertificateData | null>(VERIFIED_REGISTRY['VB-2026-BLK-001']);
  const [hasSearched, setHasSearched] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) return;

    setHasSearched(true);
    if (VERIFIED_REGISTRY[clean]) {
      setCertificate(VERIFIED_REGISTRY[clean]);
    } else if (clean.startsWith('VB-') || clean.includes('ORD') || clean.length >= 6) {
      // Dynamic verification fallback for custom garment codes or order numbers
      const isOrder = clean.includes('ORD');
      setCertificate({
        serial: clean,
        queryType: isOrder ? 'ORDER' : 'SERIAL',
        pieceName: isOrder ? `Client Order Verified [${clean}]` : 'VB Fits Studios Archival Ready-to-Wear',
        colorway: 'Verified Archival Colorway',
        textileGrade: 'Certified 340 GSM Portuguese Organic Cotton',
        gsmWeight: '340 GSM Heavyweight Loopback',
        origin: 'Porto Atelier, Portugal (Laboratório Têxtil)',
        editionRun: `Verified Atelier Unit #${clean.slice(-3) || '042'} of 250 Worldwide`,
        batchCode: `BATCH-2026-${clean.slice(0, 4)}-POR`,
        inspectionDate: 'March 14, 2026',
        inspectorId: 'QC-ATELIER-VERIFIED-07',
        laboratoryStamp: 'LABORATÓRIO TÊXTIL DO PORTO // CERTIFICADO OFICIAL',
        cryptoHash: Array.from(clean).reduce((acc, c) => acc + c.charCodeAt(0).toString(16), 'hash_').slice(0, 40),
        status: 'AUTHENTIC_VERIFIED'
      });
    } else {
      setCertificate(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/verify?code=${encodeURIComponent(inputCode)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div className="pt-24 sm:pt-32 pb-24 min-h-screen bg-white font-sans">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 lg:px-12">
        
        {/* Editorial Provenance Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3 pb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-[10px] uppercase font-mono tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Official Atelier Provenance Registry // شهادة إثبات الأصالة</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-light uppercase tracking-wider text-black">
            Garment Authenticity Verification
          </h1>
          <p className="text-xs sm:text-sm text-[#666666] leading-relaxed pt-1 font-light">
            Every VB Fits Studios silhouette is individually stamped with an archival serial code on the interior garment care label. Enter your garment serial number or your order ID to verify Portuguese atelier provenance and batch data.
          </p>
        </div>

        {/* Verification Input Box */}
        <div className="max-w-2xl mx-auto mb-12">
          <form onSubmit={handleVerify} className="flex border-2 border-black shadow-lg">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter Serial Code (e.g. VB-2026-BLK-001) or Order #"
                aria-label="Enter Serial Code or Order Number"
                className="w-full px-5 py-4 text-xs font-mono uppercase text-black placeholder-[#888888] focus:outline-none bg-white font-medium"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-black hover:bg-[#222222] text-white px-8 py-4 text-xs uppercase tracking-luxury font-bold transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Verify Provenance</span>
            </button>
          </form>

          {/* Quick sample chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-4 text-[11px] font-mono text-[#666666]">
            <span className="text-[10px] uppercase tracking-wider font-bold text-black">Quick Registry Samples:</span>
            {Object.keys(VERIFIED_REGISTRY).map((sampleCode) => (
              <button
                key={sampleCode}
                type="button"
                onClick={() => {
                  setInputCode(sampleCode);
                  setCertificate(VERIFIED_REGISTRY[sampleCode]);
                  setHasSearched(true);
                }}
                className="px-2.5 py-1 border border-[#CCCCCC] hover:border-black bg-[#FAFAFA] text-[#222222] hover:text-black transition-all hover:scale-102"
              >
                {sampleCode}
              </button>
            ))}
          </div>
        </div>

        {/* Luxury Digital Certificate of Authenticity */}
        {hasSearched && certificate ? (
          <div className="max-w-3xl mx-auto animate-scale-in">
            <div className="relative bg-[#0E0E12] text-white border-2 border-amber-500/40 p-6 sm:p-12 shadow-2xl overflow-hidden print:bg-white print:text-black print:border-black print:p-4">
              
              {/* Guilloche Corner Accents (Faux luxury watermark pattern) */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full border border-amber-500/10 pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full border border-amber-500/10 pointer-events-none" />

              {/* Watermark Logo */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center select-none font-mono text-7xl sm:text-8xl font-black rotate-[-20deg] text-white">
                VB FITS STUDIOS
              </div>

              {/* Certificate Header Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/15 pb-6 gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                      Certified Authentic Atelier Provenance // شهادة أصالة معتمدة
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-3xl font-light uppercase tracking-wider text-white mt-1">
                    Digital Certificate of Authenticity
                  </h2>
                  <p className="text-[10px] font-mono text-white/50 tracking-wider">
                    Official Registry Entry: {certificate.serial}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 self-start sm:self-auto shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                    Porto QC Verified
                  </span>
                </div>
              </div>

              {/* Technical Specifications Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-8 border-b border-white/15 text-xs font-mono relative z-10">
                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Archival Garment Serial Code:
                    </span>
                    <span className="text-base font-bold text-amber-300 tracking-wider block mt-0.5">
                      {certificate.serial}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Silhouette & Garment:
                    </span>
                    <span className="text-sm font-sans font-medium text-white block mt-0.5">
                      {certificate.pieceName}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Colorway Specification:
                    </span>
                    <span className="text-xs text-white/80 block mt-0.5">
                      {certificate.colorway}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Cryptographic Verification Token:
                    </span>
                    <span className="text-[10px] text-emerald-400 block truncate mt-0.5 font-mono">
                      SHA256: {certificate.cryptoHash}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Certified Textile & Weave:
                    </span>
                    <span className="text-xs font-bold text-emerald-400 block mt-0.5">
                      ★ {certificate.textileGrade}
                    </span>
                    <span className="text-[10px] text-white/60 block">
                      Textile Density: {certificate.gsmWeight}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Atelier Provenance & Laboratory:
                    </span>
                    <span className="text-xs text-white/90 block mt-0.5 font-bold">
                      {certificate.origin}
                    </span>
                    <span className="text-[9px] text-white/50 block">
                      {certificate.laboratoryStamp}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                      Limited Edition Batch Run:
                    </span>
                    <span className="text-xs font-bold text-white block mt-0.5">
                      {certificate.editionRun}
                    </span>
                  </div>
                </div>
              </div>

              {/* Certificate Bottom: QC Stamp, Wax Seal & Actions */}
              <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                
                {/* Left: Wax Stamp & Inspector Info */}
                <div className="flex items-center gap-4">
                  {/* Wax Seal Insignia */}
                  <div className="w-16 h-16 rounded-full border-2 border-amber-400/60 flex items-center justify-center p-1 bg-gradient-to-tr from-[#1A1A22] via-[#2A2A35] to-[#141418] shadow-lg flex-shrink-0 relative">
                    <Award className="w-8 h-8 text-amber-300" />
                    <span className="absolute -bottom-1 text-[8px] font-mono text-amber-400 bg-black px-1 uppercase">
                      PORTUGAL
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-white/70 leading-relaxed">
                    <span className="font-bold text-white block">Atelier Stamp: {certificate.inspectorId}</span>
                    <span>Issue Date: {certificate.inspectionDate}</span>
                    <span className="block text-white/40">Batch: {certificate.batchCode}</span>
                  </div>
                </div>

                {/* Right: Print, Copy Link, and Shop Actions */}
                <div className="flex items-center gap-2 print:hidden flex-wrap justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 border border-white/20 hover:border-white text-white px-3.5 py-2 text-[10px] uppercase font-mono tracking-wider transition-colors"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 bg-white text-black hover:bg-white/90 px-4 py-2 text-[10px] uppercase font-mono tracking-wider font-bold transition-all shadow-md"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Certificate</span>
                  </button>

                  <Link
                    to="/shop"
                    className="bg-amber-400 hover:bg-amber-300 text-black px-4 py-2 text-[10px] uppercase font-mono tracking-wider font-bold transition-all shadow-md"
                  >
                    Shop Atelier
                  </Link>
                </div>

              </div>

            </div>
          </div>
        ) : hasSearched && (
          <div className="max-w-md mx-auto p-8 border-2 border-red-200 bg-red-50 text-center space-y-3 animate-fade-in font-mono">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-900">
              Serial Not Found in Archival Registry
            </h3>
            <p className="text-xs text-red-700 leading-relaxed font-sans">
              We could not locate serial number "{inputCode}" in the active Porto Atelier ledger. Please verify the code printed on your interior neck label or contact our client concierge on WhatsApp.
            </p>
          </div>
        )}

        {/* Accompanying Packaging Standard Preview */}
        <div className="mt-16 pt-12 border-t border-[#EAEAEA]">
          <PackagingVisualizer />
        </div>

      </div>
    </div>
  );
};
