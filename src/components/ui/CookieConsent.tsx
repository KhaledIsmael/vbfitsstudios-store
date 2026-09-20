import React, { useState, useEffect } from 'react';
import { initAnalytics } from '../../lib/analytics';

const CONSENT_KEY = 'vbfits_consent';
const CONSENT_VERSION = 'v1'; // bump if policy changes to re-prompt

/**
 * CookieConsent — sticky bottom-bar GDPR/PECR consent banner.
 *
 * • Renders only once per session (hidden after accept/decline/dismiss).
 * • Stores decision in localStorage under `vbfits_consent`.
 * • On "Accept All", calls initAnalytics() to lazily inject GA4.
 * • "Manage Preferences" collapses into a minimal toggle panel.
 * • Zero external dependencies — pure CSS transitions.
 */
export const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) {
        // First visit — show after 1.5 s so it doesn't compete with splash anim
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
      // Already consented → init analytics immediately (no banner)
      if (stored === 'accepted') {
        initAnalytics();
      }
    } catch {
      // Private browsing — skip silently
    }
  }, []);

  function acceptAll() {
    try {
      localStorage.setItem(CONSENT_KEY, 'accepted');
    } catch {}
    initAnalytics();
    setVisible(false);
  }

  function declineAll() {
    try {
      localStorage.setItem(CONSENT_KEY, 'declined');
    } catch {}
    setVisible(false);
  }

  function savePreferences() {
    try {
      localStorage.setItem(CONSENT_KEY, analyticsEnabled ? 'accepted' : 'declined');
    } catch {}
    if (analyticsEnabled) initAnalytics();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop blur on mobile when expanded */}
      {expanded && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 9998, backdropFilter: 'blur(2px)'
          }}
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        id="cookie-consent-banner"
        role="dialog"
        aria-modal="true"
        aria-label="Cookie consent"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: '#111111',
          color: '#FFFFFF',
          padding: expanded ? '32px 24px' : '20px 24px',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.25)',
          transition: 'padding 0.3s ease',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif"
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>

          {/* ── Collapsed Banner ── */}
          {!expanded && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#FFFFFF',
                  marginBottom: 4
                }}>
                  Cookie Preferences
                </p>
                <p style={{
                  margin: 0,
                  fontSize: 11,
                  color: '#AAAAAA',
                  lineHeight: 1.6,
                  letterSpacing: '0.02em'
                }}>
                  We use essential cookies for core functionality and optional analytics to improve your experience.{' '}
                  <a
                    href="/policies/privacy"
                    style={{ color: '#FFFFFF', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                  id="cookie-manage-btn"
                  onClick={() => setExpanded(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #555555',
                    color: '#AAAAAA',
                    padding: '9px 18px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#FFFFFF';
                    (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#555555';
                    (e.currentTarget as HTMLButtonElement).style.color = '#AAAAAA';
                  }}
                >
                  Manage
                </button>
                <button
                  id="cookie-decline-btn"
                  onClick={declineAll}
                  style={{
                    background: 'transparent',
                    border: '1px solid #555555',
                    color: '#AAAAAA',
                    padding: '9px 18px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#FFFFFF';
                    (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#555555';
                    (e.currentTarget as HTMLButtonElement).style.color = '#AAAAAA';
                  }}
                >
                  Decline
                </button>
                <button
                  id="cookie-accept-btn"
                  onClick={acceptAll}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #FFFFFF',
                    color: '#111111',
                    padding: '9px 22px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#E5E5E5';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF';
                  }}
                >
                  Accept All
                </button>
              </div>
            </div>
          )}

          {/* ── Expanded Preferences Panel ── */}
          {expanded && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Cookie Preferences
                </h2>
                <button
                  onClick={() => setExpanded(false)}
                  style={{
                    background: 'none', border: 'none', color: '#AAAAAA',
                    fontSize: 18, cursor: 'pointer', padding: 4
                  }}
                  aria-label="Close preferences"
                >
                  ✕
                </button>
              </div>

              {/* Essential — always on */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 0', borderBottom: '1px solid #333333'
              }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Essential Cookies</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#888888', lineHeight: 1.5 }}>
                    Required for authentication, cart, and checkout. Cannot be disabled.
                  </p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#555555', marginLeft: 16, flexShrink: 0
                }}>Always On</span>
              </div>

              {/* Analytics — toggleable */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 0', borderBottom: '1px solid #333333'
              }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analytics Cookies</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#888888', lineHeight: 1.5 }}>
                    Helps us understand how you use the site (GA4). No personal data sold.
                  </p>
                </div>
                {/* Toggle switch */}
                <button
                  id="analytics-toggle"
                  role="switch"
                  aria-checked={analyticsEnabled}
                  onClick={() => setAnalyticsEnabled((v) => !v)}
                  style={{
                    flexShrink: 0,
                    marginLeft: 16,
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    border: 'none',
                    background: analyticsEnabled ? '#FFFFFF' : '#444444',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.25s'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: 3,
                    left: analyticsEnabled ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: analyticsEnabled ? '#111111' : '#AAAAAA',
                    transition: 'left 0.25s, background 0.25s'
                  }} />
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  id="cookie-save-prefs-btn"
                  onClick={savePreferences}
                  style={{
                    background: '#FFFFFF', border: '1px solid #FFFFFF', color: '#111111',
                    padding: '11px 28px', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Save Preferences
                </button>
                <button
                  id="cookie-accept-all-btn"
                  onClick={acceptAll}
                  style={{
                    background: 'transparent', border: '1px solid #555555', color: '#AAAAAA',
                    padding: '11px 28px', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Accept All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
