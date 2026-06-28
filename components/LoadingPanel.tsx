'use client';
import { useEffect, useState } from 'react';

const STEPS = [
  { label: 'Resolving ticker symbol…', icon: '🔍' },
  { label: 'Fetching company fundamentals…', icon: '📊' },
  { label: 'Pulling latest news & sentiment…', icon: '📰' },
  { label: 'Running fundamental analysis…', icon: '🧠' },
  { label: 'Scoring sentiment signals…', icon: '📡' },
  { label: 'Synthesizing investment decision…', icon: '⚖️' },
];

export default function LoadingPanel({ company }: { company: string }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(s => Math.min(s + 1, STEPS.length - 1));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fadeUp" style={{
      marginTop: 'var(--space-8)',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-8)',
    }}>
      <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--accent)', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 'var(--space-2)',
        }}>
          Researching
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{company}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {STEPS.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: active ? 'var(--accent-subtle)' : done ? 'rgba(34,197,94,0.06)' : 'transparent',
                border: active ? '1px solid var(--border-active)' : '1px solid transparent',
                transition: 'all 0.3s ease',
                opacity: i > activeStep ? 0.3 : 1,
              }}
            >
              {/* Status indicator */}
              <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {done ? (
                  <span style={{ color: 'var(--signal-bullish)', fontSize: 14 }}>✓</span>
                ) : active ? (
                  <span style={{
                    width: 14, height: 14,
                    border: '2px solid var(--accent)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>○</span>
                )}
              </div>
              <span style={{ fontSize: 13, color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {step.icon} {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 'var(--space-6)',
        height: 3,
        background: 'var(--bg-input)',
        borderRadius: 99,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${((activeStep + 1) / STEPS.length) * 100}%`,
          background: 'linear-gradient(90deg, var(--accent), #8b5cf6)',
          transition: 'width 0.5s ease',
          borderRadius: 99,
        }} />
      </div>
    </div>
  );
}
