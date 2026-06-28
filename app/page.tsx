'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import SearchPanel from '@/components/SearchPanel';
import ReportPanel from '@/components/ReportPanel';
import LoadingPanel from '@/components/LoadingPanel';
import { InvestmentReport } from '@/components/types';
import {
  LayoutDashboard,
  Wallet,
  Star,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  Search,
  Bell,
  User,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Shield,
  BookOpen
} from 'lucide-react';

// Default Watchlist data
const DEFAULT_WATCHLIST = [
  { name: 'AAPL', price: '$195.42', change: '+2.4%', up: true, points: [12, 15, 8, 18, 14, 22, 20, 25], sector: 'Technology', marketCap: '$3.20T' },
  { name: 'TSLA', price: '$187.20', change: '-1.1%', up: false, points: [25, 23, 19, 21, 16, 17, 14, 12], sector: 'Consumer Cyclical', marketCap: '$780B' },
  { name: 'NVDA', price: '$120.80', change: '+4.8%', up: true, points: [5, 11, 8, 18, 15, 26, 32, 40], sector: 'Technology', marketCap: '$2.80T' },
  { name: 'MSFT', price: '$420.50', change: '+0.6%', up: true, points: [20, 21, 19, 23, 22, 24, 23, 26], sector: 'Technology', marketCap: '$3.15T' },
];

function generateSparklinePath(points: number[]): string {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const width = 60;
  const height = 18;
  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height + 3;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export default function Home() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'investment' | 'watchlist' | 'activity' | 'settings'>('investment');
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizing, setIsResizing] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  // Core Agent States
  const [report, setReport] = useState<InvestmentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState('');

  // Persistent States
  const [watchlist, setWatchlist] = useState<typeof DEFAULT_WATCHLIST>([]);
  const [history, setHistory] = useState<InvestmentReport[]>([]);
  const [settings, setSettings] = useState({
    llmProvider: 'groq',
    llmModel: 'llama-3.3-70b-versatile',
    llmApiKey: '',
    alphaVantageApiKey: '',
    newsApiKey: '',
    demoMode: false,
  });

  // Interactive Header States
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [globalSearchVal, setGlobalSearchVal] = useState('');
  
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; time: string; read: boolean }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const [settingsSavedFeedback, setSettingsSavedFeedback] = useState(false);
  const [watchlistInput, setWatchlistInput] = useState('');

  // Load date on mount
  useEffect(() => {
    const d = new Date();
    setCurrentDate(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
  }, []);

  // Initialize and Sync localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Watchlist
      const localWatchlist = localStorage.getItem('investiq_watchlist');
      if (localWatchlist) {
        setWatchlist(JSON.parse(localWatchlist));
      } else {
        setWatchlist(DEFAULT_WATCHLIST);
        localStorage.setItem('investiq_watchlist', JSON.stringify(DEFAULT_WATCHLIST));
      }

      // History
      const localHistory = localStorage.getItem('investiq_history');
      if (localHistory) {
        setHistory(JSON.parse(localHistory));
      }

      // Settings
      const localSettings = localStorage.getItem('investiq_settings');
      if (localSettings) {
        setSettings(JSON.parse(localSettings));
      }

      // Notifications
      const initialNotifs = [
        { id: '1', text: 'InvestIQ AI research platform v1.2.0 initialized.', time: 'Just now', read: false },
        { id: '2', text: 'Connected to LLM: Groq (llama-3.3-70b-versatile).', time: '5m ago', read: false },
      ];
      setNotifications(initialNotifs);
    }
  }, []);

  // Sidebar drag resizer logic
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(400, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Push notifications helper
  const addNotification = (text: string) => {
    const newNotif = {
      id: Date.now().toString(),
      text,
      time: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  // Run Main AI Research Agent
  async function handleAnalyze(input: string) {
    setLoading(true);
    setError(null);
    setReport(null);
    setCompany(input);
    setActiveTab('investment');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: input, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      
      setReport(data);
      addNotification(`Analysis complete: ${data.symbol} (${data.decision}, Conf: ${data.confidence}%)`);

      // Add to search history log
      setHistory(prev => {
        const filtered = prev.filter(r => r.symbol.toUpperCase() !== data.symbol.toUpperCase());
        const updated = [data, ...filtered];
        localStorage.setItem('investiq_history', JSON.stringify(updated));
        return updated;
      });

      // Dynamically update watchlist metrics if target matches
      setWatchlist(prev => {
        const updated = prev.map(item => {
          if (item.name.toUpperCase() === data.symbol.toUpperCase()) {
            return {
              ...item,
              price: data.currentPrice ? `$${data.currentPrice.toFixed(2)}` : item.price,
              change: data.changePercent ? `${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(1)}%` : item.change,
              up: data.changePercent ? data.changePercent >= 0 : item.up,
              sector: data.valuation?.verdict || item.sector,
            };
          }
          return item;
        });
        localStorage.setItem('investiq_watchlist', JSON.stringify(updated));
        return updated;
      });

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      addNotification(`Analysis failed for "${input}": ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  // Load a report directly from history (instant load, no API call)
  const handleLoadReport = (savedReport: InvestmentReport) => {
    setReport(savedReport);
    setCompany(savedReport.companyName);
    setError(null);
    setLoading(false);
    setActiveTab('investment');
    addNotification(`Restored report for ${savedReport.symbol} from operations log.`);
  };

  // Add a symbol to the watchlist
  const handleAddWatchlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchlistInput.trim()) return;
    const symbol = watchlistInput.trim().toUpperCase();
    if (watchlist.some(w => w.name === symbol)) {
      addNotification(`"${symbol}" is already on your watchlist.`);
      setWatchlistInput('');
      return;
    }
    const newItem = {
      name: symbol,
      price: `$${(100 + Math.random() * 200).toFixed(2)}`,
      change: `${Math.random() > 0.4 ? '+' : '-'}${(Math.random() * 4).toFixed(1)}%`,
      up: true,
      points: Array.from({ length: 8 }, () => Math.floor(Math.random() * 30)),
      sector: 'Awaiting Analysis',
      marketCap: 'Estimate'
    };
    newItem.up = newItem.change.startsWith('+');
    
    const updated = [newItem, ...watchlist];
    setWatchlist(updated);
    localStorage.setItem('investiq_watchlist', JSON.stringify(updated));
    addNotification(`Added ${symbol} to watchlist.`);
    setWatchlistInput('');
  };

  // Delete from watchlist
  const handleDeleteWatchlist = (symbol: string) => {
    const updated = watchlist.filter(w => w.name !== symbol);
    setWatchlist(updated);
    localStorage.setItem('investiq_watchlist', JSON.stringify(updated));
    addNotification(`Removed ${symbol} from watchlist.`);
  };

  // Save platform settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('investiq_settings', JSON.stringify(settings));
    addNotification('Platform configurations updated.');
    setSettingsSavedFeedback(true);
    setTimeout(() => setSettingsSavedFeedback(false), 2500);
  };

  // Reset all application data back to initial defaults
  const handleResetPlatformData = () => {
    localStorage.removeItem('investiq_watchlist');
    localStorage.removeItem('investiq_history');
    localStorage.removeItem('investiq_settings');
    setWatchlist(DEFAULT_WATCHLIST);
    setHistory([]);
    setReport(null);
    setSettings({
      llmProvider: 'groq',
      llmModel: 'llama-3.3-70b-versatile',
      llmApiKey: '',
      alphaVantageApiKey: '',
      newsApiKey: '',
      demoMode: false,
    });
    addNotification('Platform reset to default settings.');
    setShowProfileMenu(false);
  };

  // Run global palette search
  const handleGlobalSearchSubmit = () => {
    if (globalSearchVal.trim()) {
      setSearchModalOpen(false);
      handleAnalyze(globalSearchVal.trim());
      setGlobalSearchVal('');
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>
      
      {/* Background glowing gradients */}
      <div className="ambient-glow-coral" style={{ top: '10%', right: '10%' }} />
      <div className="ambient-glow-lime" style={{ bottom: '15%', left: '20%' }} />

      {/* 1. Left Sidebar Navigation (Resizable) */}
      <aside style={{
        width: sidebarWidth,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '28px 20px',
        zIndex: 100,
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, var(--accent-coral), #ff7a59)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900, color: '#fff',
            boxShadow: '0 0 16px var(--accent-coral-glow)',
          }}>IQ</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            InvestIQ
          </span>
        </div>

        {/* Navigation Pills */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
            { id: 'investment', label: 'Investment', icon: <Wallet size={18} /> },
            { id: 'watchlist', label: 'Watchlist', icon: <Star size={18} /> },
            { id: 'activity', label: 'ActivityLog', icon: <ActivityIcon size={18} /> },
            { id: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> }
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--text-primary)' : 'transparent',
                  color: isActive ? 'var(--bg-base)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {item.icon}
                <span style={{ fontSize: 13.5 }}>{item.label}</span>
              </div>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 'auto' }}>
          v1.2.0 · Live Agent
        </div>

        {/* Resizer Handle */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 5,
            height: '100%',
            cursor: 'col-resize',
            background: isResizing ? 'var(--accent-coral)' : 'transparent',
            transition: 'background-color 0.15s ease',
            zIndex: 110
          }}
          onMouseDown={startResizing}
          onMouseEnter={e => { if (!isResizing) e.currentTarget.style.background = 'rgba(255, 82, 36, 0.2)'; }}
          onMouseLeave={e => { if (!isResizing) e.currentTarget.style.background = 'transparent'; }}
        />
      </aside>

      {/* 2. Main Dashboard Content Area */}
      <div style={{ marginLeft: sidebarWidth, flex: 1, display: 'flex', flexDirection: 'column', zIndex: 10, minWidth: 0 }}>
        
        {/* Header Bar */}
        <header style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(10, 11, 13, 0.6)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          {/* Active Navigation Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            <span>InvestIQ</span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, textTransform: 'capitalize' }}>
              {activeTab === 'activity' ? 'Operations Log' : activeTab === 'investment' ? 'Equity Analyzer' : activeTab}
            </span>
          </div>

          {/* Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, position: 'relative' }}>
            {/* Date Display */}
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', display: 'block' }}>
              {currentDate}
            </span>

            {/* Icons Tray */}
            <div style={{ display: 'flex', gap: 14 }}>
              {/* Search Toggle */}
              <button
                onClick={() => setSearchModalOpen(true)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', outline: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <Search size={18} />
              </button>

              {/* Notification Popover Button */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    setShowProfileMenu(false);
                    // Mark as read
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', outline: 'none', position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                  <Bell size={18} />
                  {unreadNotifCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--signal-pass)',
                      border: '1.5px solid var(--bg-sidebar)'
                    }} />
                  )}
                </button>

                {/* Notifications Dropdown Tray */}
                {showNotifications && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 32,
                    width: 320,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-active)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    padding: 16,
                    zIndex: 200,
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>NOTIFICATIONS</span>
                      <button
                        onClick={() => setNotifications([])}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        Clear All
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                        No new notifications.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto' }}>
                        {notifications.map(n => (
                          <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{n.text}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{n.time}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Avatar Trigger */}
              <div style={{ position: 'relative' }}>
                <div
                  onClick={() => {
                    setShowProfileMenu(!showProfileMenu);
                    setShowNotifications(false);
                  }}
                  style={{
                    width: 32, height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #a78bfa, #f472b6)',
                    border: '2px solid var(--border-active)',
                    cursor: 'pointer',
                  }}
                />

                {/* Profile Dropdown Menu */}
                {showProfileMenu && (
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 40,
                    width: 200,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-active)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                    padding: '12px 0',
                    zIndex: 200,
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <div style={{ padding: '0 16px 8px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Elite Investor</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Portfolio Manager</div>
                    </div>
                    <button
                      onClick={handleResetPlatformData}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--signal-pass)',
                        padding: '8px 16px',
                        fontSize: 12.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 56, 56, 0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Trash2 size={14} />
                      Reset Platform Data
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Watchlist Sparklines Ticker Strip (Only shown on Dashboard or Investment tabs) */}
        {(activeTab === 'dashboard' || activeTab === 'investment') && (
          <section style={{
            display: 'flex',
            padding: '16px 40px',
            gap: 16,
            background: 'rgba(15, 17, 21, 0.4)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              Market Pulse:
            </div>
            {watchlist.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '8px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  minWidth: 200,
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => handleAnalyze(item.name)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-active)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
              >
                {/* Ticker Name & Price */}
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{item.price}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: item.up ? 'var(--signal-invest)' : 'var(--signal-pass)', fontFamily: 'var(--font-mono)' }}>
                      {item.change}
                    </span>
                  </div>
                </div>
                {/* Sparkline Chart */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  <svg width="60" height="24" viewBox="0 0 60 24" style={{ overflow: 'visible' }}>
                    <path
                      d={generateSparklinePath(item.points)}
                      fill="none"
                      stroke={item.up ? 'var(--signal-invest)' : 'var(--signal-pass)'}
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 3. Main Dynamic Content Render Panel */}
        <main style={{ flex: 1, padding: '40px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
          
          {/* TAB 1: INVESTMENT (Original core researcher) */}
          {activeTab === 'investment' && (
            <div className="animate-fade-in">
              {/* Default Search landing page */}
              {!report && !loading && (
                <div style={{ textAlign: 'center', margin: '40px auto 48px auto', maxWidth: 640 }}>
                  <div style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--accent-coral)', letterSpacing: '0.12em',
                    textTransform: 'uppercase', marginBottom: 20,
                    padding: '4px 12px',
                    border: '1px solid var(--border-active)',
                    borderRadius: 20,
                    background: 'rgba(255, 82, 36, 0.04)',
                  }}>
                    ⚡ Real-time Equity Research Platform
                  </div>
                  <h1 style={{
                    fontSize: 'clamp(2.2rem, 4vw, 3.4rem)',
                    fontWeight: 800, letterSpacing: '-0.03em',
                    lineHeight: 1.1, marginBottom: 20,
                    color: 'var(--text-primary)',
                  }}>
                    Perform data-backed
                    <br />
                    <span style={{
                      background: 'linear-gradient(135deg, var(--accent-coral), #ff7a59)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}>
                      investment decisions.
                    </span>
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14.5, lineHeight: 1.6, marginBottom: 32 }}>
                    Search for any stock ticker or company name. The agent resolves the symbol, downloads key financials, aggregates recent news stories, and runs a structured reasoning chain via Groq LLM.
                  </p>
                </div>
              )}

              {/* Search bar integration */}
              <div style={{ maxWidth: 680, margin: '0 auto' }}>
                <SearchPanel onAnalyze={handleAnalyze} loading={loading} hasReport={!!report} />
              </div>

              {/* Error notifications */}
              {error && (
                <div style={{
                  maxWidth: 680,
                  margin: '24px auto 0 auto',
                  padding: '14px 20px',
                  background: 'rgba(255,56,56,0.06)',
                  border: '1px solid rgba(255,56,56,0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffa6a6',
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                }}>
                  ⚠️ Error: {error}
                </div>
              )}

              {/* Loading status panel */}
              {loading && (
                <div style={{ maxWidth: 680, margin: '0 auto' }}>
                  <LoadingPanel company={company} />
                </div>
              )}

              {/* Equity research report dashboard panel */}
              {report && !loading && (
                <div>
                  <ReportPanel report={report} />
                </div>
              )}

              {/* Quick Start Examples */}
              {!report && !loading && !error && (
                <div style={{ marginTop: 48, textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 16, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                    SELECT AN EXAMPLE WORKSPACE
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['Apple', 'Tesla', 'Nvidia', 'Microsoft', 'Amazon'].map(c => (
                      <button
                        key={c}
                        onClick={() => handleAnalyze(c)}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-secondary)',
                          padding: '8px 18px', fontSize: 13,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--border-active)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.background = 'var(--bg-card)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.background = 'var(--bg-surface)';
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header Title */}
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 6 }}>
                  Research Dashboard
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                  Overview of AI portfolio operations, recent findings, and sector asset breakdowns.
                </p>
              </div>

              {/* Dashboard Statistics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                {/* Stat Card 1 */}
                <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      RESEARCH PORTFOLIO
                    </span>
                    <TrendingUp size={16} style={{ color: 'var(--signal-invest)' }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>$1,248,500</div>
                  <div style={{ fontSize: 11, color: 'var(--signal-invest)', fontWeight: 600 }}>+4.8% from last week</div>
                </div>

                {/* Stat Card 2 */}
                <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      ANALYSES COMPLETED
                    </span>
                    <ActivityIcon size={16} style={{ color: 'var(--accent-coral)' }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{history.length} Done</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Log history persisted locally</div>
                </div>

                {/* Stat Card 3 */}
                <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      WATCHLIST TICKERS
                    </span>
                    <Star size={16} style={{ color: 'var(--signal-warning)' }} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{watchlist.length} Monitored</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Pulse tickers active</div>
                </div>
              </div>

              {/* Lower Section Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
                {/* Sector exposure card */}
                <div className="glass-card" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Sector Research Allocation
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { sector: 'Technology', pct: 55, color: 'var(--accent-coral)' },
                      { sector: 'Consumer Cyclical', pct: 25, color: '#a78bfa' },
                      { sector: 'Financial Services', pct: 15, color: 'var(--accent-lime)' },
                      { sector: 'Healthcare & Biotech', pct: 5, color: 'var(--text-muted)' },
                    ].map((sec, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{sec.sector}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 700 }}>{sec.pct}%</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${sec.pct}%`, background: sec.color, borderRadius: 99 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent agent runs log card */}
                <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Recent Operations log
                  </h3>
                  
                  {history.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: '24px 0', border: '1px dashed var(--border-active)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No operations recorded.</span>
                      <button
                        onClick={() => setActiveTab('investment')}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-active)', color: 'var(--text-primary)', padding: '6px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                      >
                        Start First Analysis
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {history.slice(0, 3).map((item, idx) => {
                        const isInvest = item.decision === 'INVEST';
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.companyName}</div>
                              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>{item.symbol}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <span style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: isInvest ? 'var(--signal-invest)' : 'var(--signal-pass)',
                                border: `1px solid ${isInvest ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 56, 56, 0.15)'}`,
                                background: isInvest ? 'rgba(0, 255, 136, 0.04)' : 'rgba(255, 56, 56, 0.04)',
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-sm)'
                              }}>
                                {item.decision}
                              </span>
                              <button
                                onClick={() => handleLoadReport(item)}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-coral)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                              >
                                View <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WATCHLIST */}
          {activeTab === 'watchlist' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header Title with Ticker Form */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 6 }}>
                    Monitored Equities Watchlist
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                    Monitor custom stocks and click Analyze to generate immediate research data.
                  </p>
                </div>
                
                {/* Add Stock Form */}
                <form onSubmit={handleAddWatchlist} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Enter ticker (e.g. AMZN)..."
                    value={watchlistInput}
                    onChange={e => setWatchlistInput(e.target.value)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-active)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      fontSize: 12.5,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      width: 180,
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-coral), #ff7a59)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      padding: '8px 14px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Plus size={14} /> Add
                  </button>
                </form>
              </div>

              {/* Watchlist Cards Grid */}
              {watchlist.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', border: '1px dashed var(--border-active)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Your Watchlist is Empty</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 16 }}>Add ticker symbols using the form above to monitor their performance.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  {watchlist.map((item, idx) => (
                    <div
                      key={idx}
                      className="glass-card"
                      style={{
                        padding: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 16,
                        position: 'relative'
                      }}
                    >
                      {/* Top Ticker Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                            Sector: {item.sector || 'Estimate'}
                          </div>
                        </div>

                        {/* Trash delete button */}
                        <button
                          onClick={() => handleDeleteWatchlist(item.name)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 4,
                            outline: 'none',
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--signal-pass)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Sparkline & Price Area */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{item.price}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 12, fontWeight: 600, color: item.up ? 'var(--signal-invest)' : 'var(--signal-pass)', fontFamily: 'var(--font-mono)' }}>
                            {item.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {item.change}
                          </div>
                        </div>

                        {/* Sparkline SVG */}
                        <svg width="70" height="28" viewBox="0 0 60 24" style={{ overflow: 'visible' }}>
                          <path
                            d={generateSparklinePath(item.points)}
                            fill="none"
                            stroke={item.up ? 'var(--signal-invest)' : 'var(--signal-pass)'}
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* Card Action footer */}
                      <button
                        onClick={() => handleAnalyze(item.name)}
                        style={{
                          width: '100%',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-active)',
                          color: 'var(--text-primary)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 0',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          transition: 'all 0.15s ease',
                          textAlign: 'center',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--accent-coral)';
                          e.currentTarget.style.background = 'var(--bg-card-hover)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'var(--border-active)';
                          e.currentTarget.style.background = 'var(--bg-card)';
                        }}
                      >
                        ⚡ Run Research Agent
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ACTIVITY LOG */}
          {activeTab === 'activity' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header Title */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 6 }}>
                    Research Operations Log
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                    Chronological audit log of all successfully completed AI analyst reports. Click view to reload instantly.
                  </p>
                </div>
                
                {history.length > 0 && (
                  <button
                    onClick={() => {
                      setHistory([]);
                      localStorage.removeItem('investiq_history');
                      addNotification('Operations research history log cleared.');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-active)',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 14px',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--signal-pass)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-active)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    Clear All Logs
                  </button>
                )}
              </div>

              {/* History Table/List */}
              {history.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', border: '1px dashed var(--border-active)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>No Operations Recorded</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Go to the Investment panel and search for companies to compile analytics reports.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {history.map((item, idx) => {
                    const isInvest = item.decision === 'INVEST';
                    return (
                      <div
                        key={idx}
                        className="glass-card"
                        style={{
                          padding: '16px 24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 16
                        }}
                      >
                        {/* Title and date */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                              {item.companyName}
                            </div>
                            <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                              <span>SYMBOL: {item.symbol}</span>
                              <span>•</span>
                              <span>RUN ON: {new Date(item.generatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status elements and actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 'auto' }}>
                          
                          {/* Confidence weight bar */}
                          <div style={{ display: 'none', alignItems: 'center', gap: 8, width: 140 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--bg-base)', borderRadius: 99 }}>
                              <div style={{ height: '100%', width: `${item.confidence}%`, background: 'var(--accent-coral)', borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.confidence}%</span>
                          </div>

                          {/* Verdict */}
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            color: isInvest ? 'var(--signal-invest)' : 'var(--signal-pass)',
                            background: isInvest ? 'rgba(0, 255, 136, 0.04)' : 'rgba(255, 56, 56, 0.04)',
                            border: `1px solid ${isInvest ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 56, 56, 0.15)'}`,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-sm)',
                          }}>
                            {item.decision} (CONF: {item.confidence}%)
                          </span>

                          {/* Trigger button */}
                          <button
                            onClick={() => handleLoadReport(item)}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-active)',
                              color: 'var(--text-primary)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 12px',
                              fontSize: 12,
                              cursor: 'pointer',
                              fontFamily: 'var(--font-mono)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--accent-coral)';
                              e.currentTarget.style.background = 'var(--bg-card-hover)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--border-active)';
                              e.currentTarget.style.background = 'var(--bg-card)';
                            }}
                          >
                            Load Report
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Header Title */}
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 6 }}>
                  Platform Settings & Credentials
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>
                  Configure custom LLM engines, financial API keys, and simulation modes. Settings are saved locally.
                </p>
              </div>

              {/* Form Layout */}
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. LLM Engine Group */}
                <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                    1. AI Inference Engine Settings
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Provider Selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>LLM Provider</label>
                      <select
                        value={settings.llmProvider}
                        onChange={e => setSettings({ ...settings, llmProvider: e.target.value })}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-active)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      >
                        <option value="groq">Groq (Recommended Free/Fast)</option>
                        <option value="openai">OpenAI (GPT Engine)</option>
                        <option value="anthropic">Anthropic (Claude Engine)</option>
                        <option value="openrouter">OpenRouter (Gemma/Free)</option>
                      </select>
                    </div>

                    {/* Model Override */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Model Name Override</label>
                      <input
                        type="text"
                        value={settings.llmModel}
                        onChange={e => setSettings({ ...settings, llmModel: e.target.value })}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-active)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* API Key */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Provider API Key (Optional Override)</label>
                    <input
                      type="password"
                      placeholder="Leave blank to use default server configuration API keys..."
                      value={settings.llmApiKey}
                      onChange={e => setSettings({ ...settings, llmApiKey: e.target.value })}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-active)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* 2. Financial Keys Group */}
                <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                    2. Market Data Integration Keys
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Alpha Vantage key */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Alpha Vantage API Key</label>
                      <input
                        type="text"
                        placeholder="Default is 'demo' if blank"
                        value={settings.alphaVantageApiKey}
                        onChange={e => setSettings({ ...settings, alphaVantageApiKey: e.target.value })}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-active)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* News API key */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>News API Key</label>
                      <input
                        type="text"
                        placeholder="Leave blank for mock news"
                        value={settings.newsApiKey}
                        onChange={e => setSettings({ ...settings, newsApiKey: e.target.value })}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-active)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. client settings */}
                <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.02em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                    3. Local Shell Preferences
                  </h3>

                  {/* Offline demo mode toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Force AI Simulation Fallback</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Bypasses financial fetching and forces the LLM to synthesize data and news dynamically.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, demoMode: !settings.demoMode })}
                      style={{
                        background: settings.demoMode ? 'var(--accent-coral)' : 'var(--bg-card)',
                        border: '1px solid var(--border-active)',
                        borderRadius: 20,
                        width: 48,
                        height: 24,
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        outline: 'none',
                      }}
                    >
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 3,
                        left: settings.demoMode ? 27 : 3,
                        transition: 'left 0.2s'
                      }} />
                    </button>
                  </div>
                </div>

                {/* Save button actions */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-coral), #ff7a59)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      padding: '12px 24px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    Save Configurations
                  </button>

                  {settingsSavedFeedback && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--signal-invest)', fontWeight: 600 }}>
                      <Check size={16} /> Saved Successfully!
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px 40px',
          textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 11,
          fontFamily: 'var(--font-mono)',
          marginTop: 'auto',
        }}>
          InvestIQ AI Platform · Built for Altuni AI Labs take-home assignment · All metrics are informational, not advice.
        </footer>
      </div>

      {/* 4. Global Search Modal (Command Palette Overlay) */}
      {searchModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 5, 8, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '12vh',
          zIndex: 1000,
          animation: 'fadeIn 0.25s ease'
        }}>
          {/* Glass Card Search Area */}
          <div className="glass-card animate-fade-in" style={{
            width: '100%',
            maxWidth: 600,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {/* Input Bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border-active)', paddingBottom: 12 }}>
              <Search size={20} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Global Search: Type company or ticker (e.g. Nvidia, MSFT)..."
                value={globalSearchVal}
                onChange={e => setGlobalSearchVal(e.target.value)}
                onKeyDown={(e: KeyboardEvent) => e.key === 'Enter' && handleGlobalSearchSubmit()}
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 16,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button
                onClick={() => setSearchModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Tips */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>Press ENTER to run Research Agent</span>
              <span>ESC to cancel</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
