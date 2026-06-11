"use client";

import { useState, useRef } from "react";
import Link from "next/link";

export default function MFAPage() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    setError("");
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...code];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] ?? "";
    setCode(next);
    const focusIndex = Math.min(pasted.length, 5);
    inputs.current[focusIndex]?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const full = code.join("");
    if (full.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setSubmitting(true);
    // Simulate verification — in production this calls the auth API
    setTimeout(() => {
      setSubmitting(false);
      setError("Invalid code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    }, 1200);
  }

  const filled = code.every(d => d !== "");

  return (
    <div className="w-full max-w-sm">
      {/* Card */}
      <div className="rounded-2xl border border-outline-variant bg-white shadow-sm px-8 py-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
              <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface leading-tight">BetterHealth</p>
            <p className="text-xs text-on-surface-variant leading-tight">Clinical Operations System</p>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-on-surface">Two-Factor Verification</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Enter the 6-digit code sent to your registered device to confirm your identity.
          </p>
        </div>

        {/* Authenticator icon row */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-low mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4 text-primary">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-on-surface">Authenticator App</p>
            <p className="text-xs text-on-surface-variant truncate">dr.jane.doe@betterhealth.example</p>
          </div>
        </div>

        {/* OTP input */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-3 uppercase tracking-wider">
              Verification Code
            </label>
            <div className="flex items-center gap-2 justify-between" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={`w-11 h-12 text-center text-lg font-bold font-mono rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                    ${error ? "border-error bg-error-container/20 text-error" : "border-outline-variant bg-white text-on-surface"}
                    ${digit ? "border-primary/50" : ""}
                  `}
                />
              ))}
            </div>
            {error && (
              <p className="mt-2 text-xs text-error font-medium">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!filled || submitting}
            className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold transition-all hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Verifying…
              </span>
            ) : "Verify & Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 border-t border-outline-variant" />

        {/* Secondary actions */}
        <div className="space-y-2 text-center">
          <p className="text-xs text-on-surface-variant">
            Didn&apos;t receive a code?{" "}
            <button className="text-primary font-semibold hover:underline">Resend</button>
          </p>
          <p className="text-xs text-on-surface-variant">
            Having trouble?{" "}
            <a href="mailto:it@betterhealth.example" className="text-primary font-semibold hover:underline">
              Contact IT Support
            </a>
          </p>
        </div>
      </div>

      {/* Back link */}
      <div className="text-center mt-5">
        <Link href="/dashboard" className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
