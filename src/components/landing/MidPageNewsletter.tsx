import React, { useState } from 'react';
import { subscribeNewsletter } from '../../lib/adminMarketing';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export const MidPageNewsletter: React.FC = () => {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.2 });
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setFeedback('Please provide a valid email address.');
      return;
    }

    setStatus('loading');
    setFeedback('');

    try {
      const res = await subscribeNewsletter(email, 'landing_midpage');
      if (res.success) {
        setStatus('success');
        setFeedback(res.message || 'You have been granted private access.');
        setEmail('');
      } else {
        setStatus('error');
        setFeedback(res.message || 'Subscription failed. Please try again.');
      }
    } catch {
      setStatus('error');
      setFeedback('Network error. Please try again later.');
    }
  };

  return (
    <section className="bg-[#0F0F0F] text-white py-24 sm:py-32 relative overflow-hidden border-t border-b border-white/10">
      {/* Subtle ambient luxury backdrop glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.04)_0%,transparent_70%)] pointer-events-none" />

      <div
        ref={ref}
        className={`max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-16 relative z-10 transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="max-w-3xl mx-auto text-center">
          {/* Label */}
          <span className="text-[11px] text-white/50 tracking-luxury-wide uppercase block mb-4">
            Private Distribution
          </span>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light uppercase tracking-wider mb-6 text-white font-editorial italic">
            Join the Atelier Circle
          </h2>

          {/* Description */}
          <p className="text-sm sm:text-base text-white/70 font-light leading-relaxed mb-10 max-w-xl mx-auto">
            Subscribers receive advance notifications for limited capsule editions, private salon invitations, and archival restock allocations before general release.
          </p>

          {/* Form */}
          {status === 'success' ? (
            <div className="bg-white/5 border border-white/20 p-6 max-w-md mx-auto text-center backdrop-blur-sm animate-fade-in">
              <div className="w-10 h-10 rounded-full border border-white/40 flex items-center justify-center mx-auto mb-3 text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h4 className="text-xs uppercase tracking-luxury text-white mb-1">Invitation Confirmed</h4>
              <p className="text-xs text-white/70">{feedback}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ENTER YOUR EMAIL"
                  disabled={status === 'loading'}
                  className="flex-1 bg-white/5 border border-white/20 px-5 py-3.5 text-xs text-white placeholder-white/40 tracking-wider focus:outline-none focus:border-white focus:bg-white/10 transition-colors uppercase"
                  required
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-white text-black hover:bg-white/90 px-8 py-3.5 text-xs font-semibold uppercase tracking-luxury transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {status === 'loading' ? 'Joining...' : 'Subscribe'}
                </button>
              </div>

              {status === 'error' && (
                <p className="text-xs text-rose-400 mt-3 text-left tracking-wide">
                  {feedback}
                </p>
              )}

              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-4">
                Strict confidentiality · Unsubscribe at any time
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
