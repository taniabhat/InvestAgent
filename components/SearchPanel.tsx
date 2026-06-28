'use client';
import { useState, KeyboardEvent } from 'react';

interface Props {
  onAnalyze: (company: string) => void;
  loading: boolean;
  hasReport: boolean;
}

export default function SearchPanel({ onAnalyze, loading, hasReport }: Props) {
  const [value, setValue] = useState('');

  function submit() {
    if (value.trim()) onAnalyze(value.trim());
  }

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-active)',
      borderRadius: 'var(--radius-lg)',
      padding: 6,
      boxShadow: '0 0 0 1px var(--border-subtle), 0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* Ticker icon */}
      <div style={{
        display: 'flex', alignItems: 'center',
        paddingLeft: 12, color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', fontSize: 14,
        flexShrink: 0,
      }}>
        $
      </div>
      <input
        type="text"
        placeholder="Company name or ticker (e.g. Apple, TSLA, NVDA)…"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && submit()}
        disabled={loading}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: 15,
          padding: '10px 0',
        }}
      />
      <button
        onClick={submit}
        disabled={loading || !value.trim()}
        style={{
          background: loading
            ? 'var(--bg-card-hover)'
            : 'linear-gradient(135deg, var(--accent), #6366f1)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 14,
          padding: '10px 20px',
          cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
          opacity: !value.trim() ? 0.5 : 1,
          whiteSpace: 'nowrap',
          transition: 'opacity 0.15s ease',
          display: 'flex', alignItems: 'center', gap: 6,
          flexShrink: 0,
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }} />
            Analyzing…
          </>
        ) : (
          hasReport ? 'Re-analyze' : 'Analyze'
        )}
      </button>
    </div>
  );
}
