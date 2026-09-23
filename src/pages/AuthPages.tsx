import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const navigate = useNavigate();

  // Active countdown timer for security lockout / exponential backoff
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authError) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        // Check if Supabase Auth built-in rate limit (HTTP 429) was triggered
        const errMsg = authError.message?.toLowerCase() || '';
        const isRateLimited =
          authError.status === 429 ||
          errMsg.includes('rate limit') ||
          errMsg.includes('too many requests') ||
          errMsg.includes('over_email_send_rate_limit');

        if (isRateLimited) {
          // Supabase built-in rate limit triggered
          const lockTime = 60;
          setLockoutSeconds(lockTime);
          setError(`Supabase Auth security rate limit engaged. Too many authentication attempts. Please wait ${lockTime} seconds before retrying.`);
        } else if (nextAttempts >= 3) {
          // Exponential backoff: 3rd fail = 5s, 4th fail = 10s, 5th fail = 20s, 6th fail = 40s, 7+ fail = 60s
          const exponent = nextAttempts - 3;
          const lockTime = Math.min(60, 5 * Math.pow(2, exponent));
          setLockoutSeconds(lockTime);
          setError(
            `Repeated authentication failures (${nextAttempts} attempts). Security backoff protocol activated: please wait ${lockTime} seconds before retrying.`
          );
        } else {
          setError(authError.message || 'Invalid email or password.');
        }

        setLoading(false);
        return;
      }

      // Successful login -> reset rate limiting counters
      setFailedAttempts(0);
      setLockoutSeconds(0);

      if (data.session) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="pt-28 sm:pt-36 pb-20 min-h-screen bg-white flex flex-col justify-center items-center px-6">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
            Client Authentication
          </span>
          <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black">
            Sign In
          </h1>
          <p className="text-xs text-[#777777]">
            Access your orders, saved silhouettes, and client privileges.
          </p>
        </div>

        {/* Security Lockout / Exponential Backoff Banner */}
        {isLocked && (
          <div
            className="p-4 bg-black text-white border border-white/20 text-xs flex items-center justify-between animate-fade-in font-mono shadow-md"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
              <span>
                Backoff Active: Retry in <strong>{lockoutSeconds}s</strong>
              </span>
            </div>
            <span className="text-[10px] uppercase text-white/50 tracking-wider">
              Attempt {failedAttempts}
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            className="p-4 bg-[#FFF5F5] border border-[#FEB2B2] text-xs text-[#C53030] flex items-center justify-between animate-fade-in"
            role="alert"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[#C53030] hover:text-black font-semibold ml-3"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div>
            <label htmlFor="login-email" className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLocked || loading}
              required
              className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="name@domain.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="login-password" className="block text-[11px] uppercase tracking-widest text-[#555555] font-medium">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-[11px] text-[#888888] hover:text-black transition-colors underline"
              >
                Forgot?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked || loading}
              required
              className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLocked || loading}
            className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-6 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLocked
              ? `Cooldown Active (${lockoutSeconds}s)`
              : loading
              ? 'Authenticating...'
              : 'Sign In'}
          </button>
        </form>

        {/* Register Link */}
        <div className="pt-6 border-t border-[#EAEAEA] text-center space-y-3">
          <p className="text-xs text-[#777777]">
            New to VB Fits Studios?
          </p>
          <Link
            to="/register"
            className="inline-block text-xs uppercase tracking-luxury text-black underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            Create an Account
          </Link>
        </div>

      </div>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setConfirmationNotice(false);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            name: name.trim(),
            phone: phone.trim()
          }
        }
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // If email confirmation is required by Supabase project settings
      if (data.user && !data.session) {
        setConfirmationNotice(true);
        setLoading(false);
        return;
      }

      if (data.session) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-28 sm:pt-36 pb-20 min-h-screen bg-white flex flex-col justify-center items-center px-6">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
            Client Registration
          </span>
          <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black">
            Create Account
          </h1>
          <p className="text-xs text-[#777777]">
            Receive private showroom invitations and priority drop notifications.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-[#FFF5F5] border border-[#FEB2B2] text-xs text-[#C53030] flex items-center justify-between animate-fade-in">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[#C53030] hover:text-black font-semibold ml-3"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Confirmation State */}
        {confirmationNotice ? (
          <div className="p-6 bg-[#FAFAFA] border border-[#EAEAEA] text-center space-y-4 animate-fade-in">
            <h3 className="text-xs uppercase tracking-luxury text-black font-medium">Verification Link Dispatched</h3>
            <p className="text-xs text-[#666666] leading-relaxed">
              We have sent an authentication link to <strong className="text-black">{email}</strong>. Please check your inbox to confirm your account and activate your private client access.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="text-xs uppercase tracking-luxury text-black underline underline-offset-4 hover:opacity-60"
              >
                Proceed to Sign In
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div>
              <label htmlFor="register-name" className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                placeholder="e.g. Christian Dior"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                placeholder="name@domain.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="register-phone" className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
                Mobile Phone Number
              </label>
              <input
                id="register-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                placeholder="+20 100 000 0000"
                autoComplete="tel"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />
            </div>

            <p className="text-[11px] text-[#777777] leading-relaxed">
              By registering, you agree to our Terms of Service and acknowledge our Privacy Policy.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-6 font-medium transition-all duration-300 disabled:opacity-60"
            >
              {loading ? 'Creating Account...' : 'Register'}
            </button>
          </form>
        )}

        {/* Login Link */}
        <div className="pt-6 border-t border-[#EAEAEA] text-center space-y-3">
          <p className="text-xs text-[#777777]">
            Already have an account?
          </p>
          <Link
            to="/login"
            className="inline-block text-xs uppercase tracking-luxury text-black underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            Sign In
          </Link>
        </div>

      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-28 sm:pt-36 pb-20 min-h-screen bg-white flex flex-col justify-center items-center px-6">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-[10px] text-[#888888] tracking-luxury uppercase">
            Account Recovery
          </span>
          <h1 className="text-2xl sm:text-3xl font-light uppercase tracking-wider text-black">
            Reset Password
          </h1>
          <p className="text-xs text-[#777777]">
            Enter your account email and we will send you private instructions to securely reset your credentials.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-[#FFF5F5] border border-[#FEB2B2] text-xs text-[#C53030] flex items-center justify-between animate-fade-in">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[#C53030] hover:text-black font-semibold ml-3"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {submitted ? (
          <div className="p-6 bg-[#FAFAFA] border border-[#EAEAEA] text-center space-y-3 animate-fade-in">
            <p className="text-xs text-black font-medium">Reset instructions sent.</p>
            <p className="text-xs text-[#666666]">
              Please check your inbox at <span className="font-semibold">{email}</span>.
            </p>
            <div className="pt-4">
              <Link
                to="/login"
                className="text-xs uppercase tracking-luxury text-black underline underline-offset-4"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div>
              <label htmlFor="forgot-email" className="block text-[11px] uppercase tracking-widest text-[#555555] mb-2 font-medium">
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#FAFAFA] border border-[#EAEAEA] px-4 py-3.5 text-xs text-black focus:outline-none focus:border-black transition-colors rounded-none"
                placeholder="name@domain.com"
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111111] hover:bg-black text-white text-xs uppercase tracking-luxury py-4 px-6 font-medium transition-all duration-300 disabled:opacity-60"
            >
              {loading ? 'Sending Instructions...' : 'Send Instructions'}
            </button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-xs text-[#777777] hover:text-black transition-colors"
              >
                &larr; Back to Sign In
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
