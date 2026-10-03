import React, { useState, useEffect, useId } from 'react';
import { getShippingZones, type ShippingZone } from '../../lib/shippingZones';

// ─── Icons (inline SVG, no external dep) ─────────────────────────────────────

const TruckIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Result Card ──────────────────────────────────────────────────────────────

interface DeliveryResultProps {
  zone: ShippingZone;
}

const DeliveryResult: React.FC<DeliveryResultProps> = ({ zone }) => {
  const dayRange =
    zone.min_days === zone.max_days
      ? `${zone.min_days} business days`
      : `${zone.min_days}–${zone.max_days} business days`;

  // Speed badge colour based on delivery window
  const isFast = zone.max_days <= 4;
  const isMedium = zone.max_days <= 6;

  return (
    <div className="mt-3 border border-[#EAEAEA] bg-white animate-fade-in">
      {/* Delivery window row */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-[#F0F0F0]">
        <TruckIcon
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            isFast ? 'text-[#111111]' : isMedium ? 'text-[#555555]' : 'text-[#888888]'
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[#888888] mb-0.5">
            Estimated Delivery
          </p>
          <p className="text-sm font-medium text-[#111111]">
            {dayRange}
          </p>
          <p className="text-[11px] text-[#666666] mt-0.5">
            to {zone.governorate}
            {zone.governorate_ar ? (
              <span className="ml-1.5 text-[#AAAAAA]">/ {zone.governorate_ar}</span>
            ) : null}
          </p>
        </div>

        {/* Speed pill */}
        <span
          className={`flex-shrink-0 text-[9px] uppercase tracking-wider font-mono px-2 py-0.5 border ${
            isFast
              ? 'border-black text-black'
              : isMedium
                ? 'border-[#888888] text-[#888888]'
                : 'border-[#BBBBBB] text-[#BBBBBB]'
          }`}
        >
          {isFast ? 'Express' : isMedium ? 'Standard' : 'Remote'}
        </span>
      </div>

      {/* COD row */}
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
            zone.cod_available
              ? 'bg-[#111111] text-white'
              : 'bg-[#F0F0F0] text-[#BBBBBB]'
          }`}
        >
          {zone.cod_available ? (
            <CheckIcon className="w-2.5 h-2.5" />
          ) : (
            <CrossIcon className="w-2.5 h-2.5" />
          )}
        </span>
        <span className="text-[11px] text-[#444444]">
          {zone.cod_available
            ? 'Cash on Delivery available for this area'
            : 'Cash on Delivery not available — online payment only'}
        </span>
      </div>
    </div>
  );
};

// ─── Main Widget ──────────────────────────────────────────────────────────────

interface DeliveryCheckerProps {
  /** Optional: reserved for future per-product shipping rule overrides */
  productId?: string;
}

export const DeliveryChecker: React.FC<DeliveryCheckerProps> = () => {
  const selectId = useId();

  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(true);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('');
  const [result, setResult] = useState<ShippingZone | null>(null);

  // Fetch all zones once on mount
  useEffect(() => {
    let active = true;
    setIsLoadingZones(true);
    getShippingZones().then((data) => {
      if (active) {
        setZones(data);
        setIsLoadingZones(false);
      }
    });
    return () => { active = false; };
  }, []);

  // Perform lookup whenever the selected governorate changes
  useEffect(() => {
    if (!selectedGovernorate) {
      setResult(null);
      return;
    }
    const zone = zones.find(
      (z) => z.governorate === selectedGovernorate
    ) ?? null;
    setResult(zone);
  }, [selectedGovernorate, zones]);

  return (
    <div className="border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <TruckIcon className="w-3.5 h-3.5 text-[#444444]" />
        <span className="text-[10px] uppercase tracking-widest text-[#444444] font-medium">
          Check Delivery
        </span>
      </div>

      {/* Governorate dropdown */}
      <div className="relative">
        <label htmlFor={selectId} className="sr-only">
          Select your governorate
        </label>
        <select
          id={selectId}
          value={selectedGovernorate}
          onChange={(e) => setSelectedGovernorate(e.target.value)}
          disabled={isLoadingZones}
          className={[
            'w-full appearance-none bg-white border border-[#EAEAEA] px-3 py-2.5 pr-8',
            'text-xs text-[#111111] focus:outline-none focus:border-black transition-colors',
            'disabled:opacity-50 disabled:cursor-wait',
          ].join(' ')}
          aria-label="Select governorate for delivery estimate"
        >
          <option value="">
            {isLoadingZones ? 'Loading regions…' : '— Select your governorate —'}
          </option>
          {zones.map((zone) => (
            <option key={zone.governorate} value={zone.governorate}>
              {zone.governorate}
              {zone.governorate_ar ? ` / ${zone.governorate_ar}` : ''}
            </option>
          ))}
        </select>

        {/* Custom chevron — overrides the OS default */}
        <span
          aria-hidden="true"
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#888888]"
        >
          <svg viewBox="0 0 10 6" className="w-2.5 h-2.5 fill-current">
            <path d="M0 0l5 6 5-6z" />
          </svg>
        </span>
      </div>

      {/* Result card — animates in on zone selection */}
      {result && <DeliveryResult zone={result} />}

      {/* Footer note */}
      <p className="text-[10px] text-[#AAAAAA] mt-3 leading-relaxed">
        Delivery times are estimates and may vary during peak periods.
        Orders placed before 2 PM ship same day.
      </p>
    </div>
  );
};
