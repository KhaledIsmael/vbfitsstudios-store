import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * AuthCallbackPage
 *
 * Handles the redirect from Supabase email links:
 *  - Email confirmation (type=signup)
 *  - Password reset (type=recovery)
 *  - Magic link (type=magiclink)
 *
 * Supabase v2 sends the user to:
 *   /auth/callback?token_hash=<hash>&type=signup
 *
 * We exchange the token_hash for a live session via verifyOtp, then
 * redirect to the appropriate destination.
 */
export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your account...');

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as 'signup' | 'recovery' | 'magiclink' | null;
    const next = searchParams.get('next') || '/';

    const handleCallback = async () => {
      // ── Strategy 1: token_hash flow (Supabase v2 PKCE) ─────────────────
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type === 'signup' ? 'signup' : type === 'recovery' ? 'recovery' : 'magiclink'
        });

        if (error) {
          console.error('[AuthCallback] verifyOtp error:', error.message);
          setStatus('error');
          setMessage(
            error.message?.includes('expired')
              ? 'This verification link has expired. Please request a new one.'
              : `Verification failed: ${error.message}`
          );
          return;
        }

        setStatus('success');

        if (type === 'recovery') {
          setMessage('Password reset verified. Redirecting...');
          setTimeout(() => navigate('/profile', { replace: true }), 1500);
        } else {
          setMessage('Account verified! Welcome to VB Fits Studios.');
          setTimeout(() => navigate('/', { replace: true }), 1500);
        }
        return;
      }

      // ── Strategy 2: Legacy implicit flow — session arrives in URL hash ──
      // Supabase sometimes appends #access_token=...&refresh_token=... to the URL.
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // The Supabase JS client auto-detects and sets the session from the hash
        // when onAuthStateChange fires — we just need to wait briefly.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus('success');
          setMessage('Account verified! Welcome to VB Fits Studios.');
          setTimeout(() => navigate(next, { replace: true }), 1500);
          return;
        }
      }

      // ── Fallback: check if already authenticated ─────────────────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus('success');
        setMessage('Already authenticated. Redirecting...');
        setTimeout(() => navigate(next, { replace: true }), 1000);
        return;
      }

      // No recognisable auth params — send to login
      setStatus('error');
      setMessage('Invalid or expired verification link. Please try registering again or contact support.');
    };

    handleCallback();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">

        {/* Brand Logo */}
        <img
          src="/assets/logo/logo-dark.png"
          alt="VB Fits Studios"
          className="h-10 w-auto mx-auto object-contain"
        />

        {status === 'loading' && (
          <>
            {/* Spinner */}
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-[#EAEAEA] border-t-black rounded-full animate-spin" />
            </div>
            <p className="text-xs text-[#666666] uppercase tracking-widest">{message}</p>
          </>
        )}

        {status === 'success' && (
          <div className="space-y-3 animate-fade-in">
            {/* Green checkmark */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-sm uppercase tracking-luxury text-black font-medium">{message}</h2>
            <p className="text-xs text-[#888888]">You will be redirected automatically...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 animate-fade-in">
            {/* Red X */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-[#FFF5F5] border border-[#FEB2B2] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C53030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
            <h2 className="text-sm uppercase tracking-luxury text-black font-medium">Verification Failed</h2>
            <p className="text-xs text-[#C53030] leading-relaxed">{message}</p>
            <div className="flex flex-col gap-2 pt-2">
              <a
                href="/register"
                className="text-xs uppercase tracking-luxury text-black underline underline-offset-4 hover:opacity-60 transition-opacity"
              >
                Create a New Account
              </a>
              <a
                href="/login"
                className="text-xs text-[#888888] hover:text-black transition-colors"
              >
                Back to Sign In
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
