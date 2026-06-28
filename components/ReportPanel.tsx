'use client';

import { useState } from 'react';
import { InvestmentReport, AnalysisStep } from './types';

interface Props {
  report: InvestmentReport;
}

export default function ReportPanel({ report }: Props) {
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'netIncome'>('revenue');
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number | null>(null);
  const [hoveredStepIdx, setHoveredStepIdx] = useState<number | null>(null);

  const isInvest = report.decision === 'INVEST';
  
  // Dynamic theme colors depending on the AI verdict
  const verdictColor = isInvest ? 'var(--signal-invest)' : 'var(--signal-pass)';
  const verdictBg = isInvest ? 'rgba(0, 255, 136, 0.04)' : 'rgba(255, 56, 56, 0.04)';
  const verdictBorder = isInvest ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 56, 56, 0.15)';

  const sentimentColor = {
    Bullish: 'var(--signal-invest)',
    Bearish: 'var(--signal-pass)',
    Neutral: 'var(--text-secondary)',
    Mixed: 'var(--signal-warning)',
  }[report.sentiment.overall] || 'var(--text-secondary)';

  const valuationColor = {
    'Undervalued': 'var(--signal-invest)',
    'Fairly Valued': 'var(--signal-warning)',
    'Overvalued': 'var(--signal-pass)',
  }[report.valuation.verdict] || 'var(--text-secondary)';

  // Core metrics extracted from overview
  const peVal = report.steps.find(s => s.step.toLowerCase().includes('valuation'))?.finding.match(/\d+(\.\d+)?/)?.[0] || 'N/A';
  const pegVal = report.steps.find(s => s.step.toLowerCase().includes('valuation'))?.finding.match(/PEG\s*ratio\s*of\s*(\d+(\.\d+)?)/i)?.[1] || 'N/A';
  
  // Parse financial data for chart
  const financials = report.historicalFinancials || [];
  const years = financials.map(f => f.year);
  const chartValues = financials.map(f => activeMetric === 'revenue' ? f.revenue : f.netIncome);
  
  // Scale math for chart SVG (viewBox="0 0 540 200")
  const chartWidth = 460;
  const chartHeight = 130;
  const paddingLeft = 55;
  const paddingTop = 25;
  const maxVal = Math.max(...chartValues) * 1.15;
  const minVal = Math.min(...chartValues) * 0.85 > 0 ? Math.min(...chartValues) * 0.85 : 0;
  const valRange = maxVal - minVal || 1;

  // Build coordinate points
  const points = chartValues.map((val, idx) => {
    const x = paddingLeft + (idx / (chartValues.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((val - minVal) / valRange) * chartHeight;
    return { x, y, val, year: years[idx] };
  });

  // SVG Line & Area Path strings
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`;

  // Colors for reasoning steps vertical bars
  const stepColors = [
    '#ff5224', // Valuation - Orange/Coral
    '#00ff88', // Profitability - Lime Green
    '#ffd13b', // Growth - Yellow
    '#f0f2f5', // Risk/Debt - White
    '#3b82f6', // Sentiment - Blue
  ];

  return (
    <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Demo mode indicator */}
      {report.dataMode === 'demo' && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(255, 209, 59, 0.05)',
          border: '1px solid rgba(255, 209, 59, 0.15)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--signal-warning)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          ⚡ Running in offline demo mode with mock company profile. Configure Alpha Vantage API key for live analysis.
        </div>
      )}

      {/* Synthesized mode indicator */}
      {report.dataMode === 'synthesized' && (
        <div style={{
          padding: '10px 16px',
          background: 'rgba(0, 255, 136, 0.05)',
          border: '1px solid rgba(0, 255, 136, 0.15)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--signal-invest)',
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          🧠 Research synthesized by InvestIQ AI Agent fallback engine. Public financial databases were rate-limited or didn't list this ticker.
        </div>
      )}

      {/* UPPER GRID - Row 1 (Company Card + Historical Chart) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        
        {/* Left Card: Company Profile & Key Metrics */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: verdictColor, border: `1px solid ${verdictBorder}`,
                borderRadius: 'var(--radius-sm)', padding: '2px 8px', background: verdictBg
              }}>
                {report.symbol}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Equity Profile
              </span>
            </div>

            {/* Company Name */}
            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4, color: 'var(--text-primary)' }}>
              {report.companyName}
            </h2>
            
            {/* Sector / Industry */}
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Research Sector: Live Financial Market Data
            </div>
          </div>

          {/* Mini-KPI Grid (4 metrics) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Decision Verdict', val: report.decision, color: verdictColor, highlight: true },
              { label: 'Est. valuation', val: report.valuation.verdict, color: valuationColor },
              { label: 'News Sentiment', val: report.sentiment.overall, color: sentimentColor },
              { label: 'Report Confidence', val: `${report.confidence}%`, color: 'var(--text-primary)' },
            ].map((m, i) => (
              <div key={i} style={{
                padding: '12px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>
                  {m.val}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Dynamic Interactive SVG Area Chart */}
        <div className="glass-card" style={{ padding: 24, position: 'relative', overflow: 'visible' }}>
          
          {/* Chart Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                Financial Growth Performance
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Values in Billions USD (Annualized)
              </span>
            </div>

            {/* Toggle switch tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-base)',
              padding: 2,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}>
              {(['revenue', 'netIncome'] as const).map(metric => (
                <button
                  key={metric}
                  onClick={() => setActiveMetric(metric)}
                  style={{
                    background: activeMetric === metric ? 'var(--bg-card)' : 'transparent',
                    border: 'none',
                    color: activeMetric === metric ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {metric === 'revenue' ? 'Rev' : 'Net Inc'}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Canvas */}
          <div style={{ position: 'relative', width: '100%', height: 160 }}>
            <svg width="100%" height="100%" viewBox="0 0 540 200" style={{ overflow: 'visible' }}>
              <defs>
                {/* Neon Orange/Coral Chart Area Gradient */}
                <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-coral)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent-coral)" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Chart Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = paddingTop + p * chartHeight;
                return (
                  <line
                    key={i}
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + chartWidth}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.03)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Custom SVG Path Fills */}
              {financials.length > 0 && (
                <>
                  {/* Glowing Filled Area under line */}
                  <path d={areaPath} fill="url(#chartGlow)" />
                  
                  {/* Chart Line Path */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--accent-coral)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: 'drop-shadow(0 2px 8px var(--accent-coral-glow))' }}
                  />

                  {/* Vertical hover marker line */}
                  {hoveredChartIdx !== null && (
                    <line
                      x1={points[hoveredChartIdx].x}
                      y1={paddingTop}
                      x2={points[hoveredChartIdx].x}
                      y2={paddingTop + chartHeight}
                      stroke="rgba(255, 255, 255, 0.15)"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Circle nodes for data points */}
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredChartIdx === i ? 6 : 4}
                      fill="var(--bg-base)"
                      stroke="var(--accent-coral)"
                      strokeWidth={hoveredChartIdx === i ? 3 : 2}
                      style={{ cursor: 'pointer', transition: 'r 0.15s ease, stroke-width 0.15s ease' }}
                      onMouseEnter={() => setHoveredChartIdx(i)}
                      onMouseLeave={() => setHoveredChartIdx(null)}
                    />
                  ))}
                </>
              )}

              {/* X-Axis labels */}
              {points.map((p, i) => (
                <text
                  key={i}
                  x={p.x}
                  y={paddingTop + chartHeight + 18}
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {p.year}
                </text>
              ))}

              {/* Y-Axis scale markers */}
              {[minVal, minVal + valRange * 0.5, maxVal].map((val, i) => {
                const y = paddingTop + chartHeight - (i / 2) * chartHeight;
                return (
                  <text
                    key={i}
                    x={paddingLeft - 8}
                    y={y + 4}
                    fill="var(--text-muted)"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    textAnchor="end"
                  >
                    ${val.toFixed(0)}B
                  </text>
                );
              })}
            </svg>

            {/* Interactive HTML Hover Tooltip overlay */}
            {hoveredChartIdx !== null && points[hoveredChartIdx] && (
              <div style={{
                position: 'absolute',
                left: `${(points[hoveredChartIdx].x / 540) * 100}%`,
                top: `${(points[hoveredChartIdx].y / 200) * 100 - 32}%`,
                transform: 'translateX(-50%)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-active)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
                zIndex: 20,
                whiteSpace: 'nowrap',
              }}>
                <strong>{activeMetric === 'revenue' ? 'Revenue' : 'Net Income'}:</strong> ${points[hoveredChartIdx].val.toFixed(1)}B
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Rationale Card */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Executive Investment Rationale
        </h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          {report.summary}
        </p>
      </div>

      {/* LOWER GRID - Row 2 (Scoring Bars + Semicircle Gauge + Sentiment Insights) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20 }}>
        
        {/* Left Column: Dimension Score Vertical Chart */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
            Dimension Analysis Scoring
          </h3>

          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', flex: 1, height: 160, paddingBottom: 10 }}>
            {report.steps.slice(0, 5).map((step, idx) => {
              const score = step.confidence * 100;
              const barHeight = `${Math.max(score, 15)}%`;
              const color = stepColors[idx] || '#fff';
              const isHovered = hoveredStepIdx === idx;
              
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    width: 48,
                    position: 'relative',
                  }}
                  onMouseEnter={() => setHoveredStepIdx(idx)}
                  onMouseLeave={() => setHoveredStepIdx(null)}
                >
                  {/* Floating value hover tag */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      top: -24,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-active)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '2px 6px',
                      fontSize: 10.5,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                      zIndex: 30,
                    }}>
                      {score.toFixed(0)}%
                    </div>
                  )}

                  {/* Vertical rounded bar fill */}
                  <div style={{
                    width: 14,
                    height: barHeight,
                    background: color,
                    borderRadius: '6px 6px 0 0',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isHovered ? `0 0 16px ${color}80` : 'none',
                    opacity: isHovered ? 1 : 0.8,
                    cursor: 'pointer',
                  }} />

                  {/* Dimension name key */}
                  <span style={{
                    fontSize: 9.5,
                    fontFamily: 'var(--font-mono)',
                    color: isHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                    marginTop: 8,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {step.step.replace(/Analysis/i, '').trim()}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Brief feedback explanation of hovered step */}
          <div style={{
            marginTop: 16,
            height: 38,
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
          }}>
            {hoveredStepIdx !== null && report.steps[hoveredStepIdx] ? (
              <span>
                {report.steps[hoveredStepIdx].step}: {report.steps[hoveredStepIdx].finding.slice(0, 50)}...
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Hover bars to inspect research findings
              </span>
            )}
          </div>
        </div>

        {/* Center Column: Semicircular Confidence Gauge Card */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'flex-start', marginBottom: 16 }}>
            Decision Confidence Gauge
          </h3>

          <div style={{ position: 'relative', width: 200, height: 120, display: 'flex', justifyContent: 'center' }}>
            <svg width="180" height="120" viewBox="0 0 120 80">
              {/* Semicircle track bg */}
              <path
                d="M 20,70 A 40,40 0 0,1 100,70"
                fill="none"
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              
              {/* Semicircle track indicator fill */}
              <path
                d="M 20,70 A 40,40 0 0,1 100,70"
                fill="none"
                stroke={verdictColor}
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeDasharray="125.66"
                strokeDashoffset={125.66 - (125.66 * (report.confidence / 100))}
                style={{
                  transition: 'stroke-dashoffset 1s ease-out',
                  filter: `drop-shadow(0 2px 6px ${verdictBg})`
                }}
              />
            </svg>

            {/* Text details in middle of gauge */}
            <div style={{
              position: 'absolute',
              bottom: 12,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                AI Recommendation
              </span>
              <span style={{ fontSize: 32, fontWeight: 900, color: verdictColor, fontFamily: 'var(--font-mono)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                {report.decision}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {report.confidence}% confidence
              </span>
            </div>
          </div>
          
          <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)', margin: '14px 0' }} />
          
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '0 8px' }}>
            Decision matrix combines valuation, growth trends, news risk, and balance sheets.
          </div>
        </div>

        {/* Right Column: News bulletins & source citation links */}
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            News Bulletins & Sentiment
          </h3>

          {/* Sentiment Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Market Sentiment:</span>
            <span style={{
              background: sentimentColor + '15',
              color: sentimentColor,
              padding: '2px 8px',
              borderRadius: 20,
              fontSize: 10.5,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {report.sentiment.overall}
            </span>
          </div>

          {/* Bullet highlights */}
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, marginBottom: 20 }}>
            {report.sentiment.newsHighlights.slice(0, 3).map((hl, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, display: 'flex', gap: 8 }}>
                <span style={{ color: sentimentColor, flexShrink: 0 }}>▪</span>
                <span>{hl}</span>
              </li>
            ))}
          </ul>

          {/* Sources button pills */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
          }}>
            {report.sources.slice(0, 3).map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--text-primary)',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-active)';
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--bg-card)';
                }}
              >
                <span>🌐 {src.label.slice(0, 18)}...</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>↗</span>
              </a>
            ))}
          </div>
        </div>

      </div>

      {/* Reasoning Steps detailed list */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Structured Research Reasoning Chain
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {report.steps.map((step, idx) => {
            const signalTextColors: Record<string, string> = {
              bullish: 'var(--signal-invest)',
              bearish: 'var(--signal-pass)',
              neutral: 'var(--text-secondary)',
            };
            const signalBgColors: Record<string, string> = {
              bullish: 'rgba(0, 255, 136, 0.04)',
              bearish: 'rgba(255, 56, 56, 0.04)',
              neutral: 'rgba(255, 255, 255, 0.02)',
            };
            const sc = signalTextColors[step.signal.toLowerCase()] || 'var(--text-secondary)';
            const sbg = signalBgColors[step.signal.toLowerCase()] || 'transparent';

            return (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '14px 18px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <strong style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
                      {step.step}
                    </strong>
                  </div>
                  
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: sc,
                    background: sbg,
                    border: `1px solid ${sc}20`,
                    padding: '2px 8px',
                    borderRadius: 20,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {step.signal}
                  </span>
                </div>
                
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {step.finding}
                </p>
                
                {/* Confidence line */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Weight
                  </span>
                  <div style={{ flex: 1, height: 4, background: 'var(--bg-base)', borderRadius: 99 }}>
                    <div style={{
                      height: '100%',
                      width: `${step.confidence * 100}%`,
                      background: sc,
                      borderRadius: 99,
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {(step.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
