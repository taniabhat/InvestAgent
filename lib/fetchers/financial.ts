// lib/fetchers/financial.ts
// Fetches company fundamentals, news, and price data from public APIs

import axios from 'axios';

const AV_BASE = 'https://www.alphavantage.co/query';
const AV_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';

// Simple in-memory rate limiter
const requestQueue: number[] = [];
const RPM = parseInt(process.env.RATE_LIMIT_RPM || '10');

async function rateLimitedFetch(url: string): Promise<unknown> {
  const now = Date.now();
  // Remove requests older than 1 minute
  while (requestQueue.length > 0 && requestQueue[0] < now - 60000) {
    requestQueue.shift();
  }
  if (requestQueue.length >= RPM) {
    const waitMs = 60000 - (now - requestQueue[0]) + 100;
    await new Promise(r => setTimeout(r, waitMs));
  }
  requestQueue.push(Date.now());
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  peRatio: string;
  pegRatio: string;
  priceToBook: string;
  eps: string;
  revenueGrowthYoY: string;
  profitMargin: string;
  debtToEquity: string;
  returnOnEquity: string;
  dividendYield: string;
  week52High: string;
  week52Low: string;
  analystTarget: string;
  exchange: string;
  currency: string;
}

export interface PriceData {
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: string;
  relevanceScore: number;
}

export interface IncomeData {
  annualRevenue: string;
  annualNetIncome: string;
  annualEBITDA: string;
  quarterlyRevenue: string;
  quarterlyNetIncome: string;
}

// Mock data for when APIs are unavailable (demo / offline mode)
export function mockCompanyOverview(symbol: string): CompanyOverview {
  const mocks: Record<string, Partial<CompanyOverview>> = {
    AAPL: {
      name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics',
      marketCap: '3200000000000', peRatio: '31.2', pegRatio: '2.8', priceToBook: '48.5',
      eps: '6.42', profitMargin: '0.253', debtToEquity: '151', returnOnEquity: '1.47',
      dividendYield: '0.005', week52High: '199.62', week52Low: '164.08',
      analystTarget: '210', revenueGrowthYoY: '0.024',
      description: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.',
      exchange: 'NASDAQ', currency: 'USD',
    },
    TSLA: {
      name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers',
      marketCap: '780000000000', peRatio: '58.3', pegRatio: '3.1', priceToBook: '12.1',
      eps: '4.22', profitMargin: '0.074', debtToEquity: '18', returnOnEquity: '0.21',
      dividendYield: '0', week52High: '278.98', week52Low: '138.80',
      analystTarget: '220', revenueGrowthYoY: '0.019',
      description: 'Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, energy generation and storage systems, and related services.',
      exchange: 'NASDAQ', currency: 'USD',
    },
    NVDA: {
      name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors',
      marketCap: '2800000000000', peRatio: '65.4', pegRatio: '1.8', priceToBook: '42.3',
      eps: '17.48', profitMargin: '0.552', debtToEquity: '42', returnOnEquity: '1.24',
      dividendYield: '0.001', week52High: '974.00', week52Low: '393.33',
      analystTarget: '1100', revenueGrowthYoY: '2.18',
      description: 'NVIDIA Corporation provides graphics, compute and networking solutions in the United States, Taiwan, China, and internationally.',
      exchange: 'NASDAQ', currency: 'USD',
    },
  };
  const base = mocks[symbol.toUpperCase()] || {};
  return {
    symbol: symbol.toUpperCase(),
    name: base.name || `${symbol} Corporation`,
    description: base.description || 'No description available.',
    sector: base.sector || 'Unknown',
    industry: base.industry || 'Unknown',
    marketCap: base.marketCap || '0',
    peRatio: base.peRatio || 'N/A',
    pegRatio: base.pegRatio || 'N/A',
    priceToBook: base.priceToBook || 'N/A',
    eps: base.eps || 'N/A',
    revenueGrowthYoY: base.revenueGrowthYoY || 'N/A',
    profitMargin: base.profitMargin || 'N/A',
    debtToEquity: base.debtToEquity || 'N/A',
    returnOnEquity: base.returnOnEquity || 'N/A',
    dividendYield: base.dividendYield || '0',
    week52High: base.week52High || 'N/A',
    week52Low: base.week52Low || 'N/A',
    analystTarget: base.analystTarget || 'N/A',
    exchange: base.exchange || 'NYSE',
    currency: base.currency || 'USD',
  };
}

export function mockPriceData(): PriceData {
  const price = 150 + Math.random() * 100;
  const prev = price * (1 + (Math.random() - 0.5) * 0.04);
  return {
    currentPrice: parseFloat(price.toFixed(2)),
    previousClose: parseFloat(prev.toFixed(2)),
    change: parseFloat((price - prev).toFixed(2)),
    changePercent: parseFloat(((price - prev) / prev * 100).toFixed(2)),
    volume: (Math.floor(Math.random() * 50000000)).toString(),
  };
}

export function mockNews(symbol: string): NewsItem[] {
  return [
    {
      title: `${symbol} Reports Strong Quarterly Earnings`,
      summary: 'Company beats analyst estimates with solid revenue growth and improved margins.',
      url: 'https://finance.yahoo.com',
      source: 'Yahoo Finance',
      publishedAt: new Date().toISOString(),
      sentiment: 'Bullish',
      relevanceScore: 0.95,
    },
    {
      title: `Analysts Raise Price Target for ${symbol}`,
      summary: 'Several Wall Street firms increase their price targets following recent business developments.',
      url: 'https://www.marketwatch.com',
      source: 'MarketWatch',
      publishedAt: new Date(Date.now() - 86400000).toISOString(),
      sentiment: 'Bullish',
      relevanceScore: 0.88,
    },
    {
      title: `${symbol} Faces Regulatory Headwinds in Key Markets`,
      summary: 'Regulatory challenges in certain geographies could impact near-term growth prospects.',
      url: 'https://www.reuters.com',
      source: 'Reuters',
      publishedAt: new Date(Date.now() - 172800000).toISOString(),
      sentiment: 'Bearish',
      relevanceScore: 0.72,
    },
  ];
}

export async function fetchCompanyOverview(symbol: string, apiKey?: string): Promise<CompanyOverview> {
  const activeKey = apiKey || AV_KEY;
  if (activeKey === 'demo') return mockCompanyOverview(symbol);
  try {
    const data = await rateLimitedFetch(
      `${AV_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${activeKey}`
    ) as Record<string, string>;
    if (!data.Symbol) return mockCompanyOverview(symbol);
    return {
      symbol: data.Symbol,
      name: data.Name,
      description: data.Description,
      sector: data.Sector,
      industry: data.Industry,
      marketCap: data.MarketCapitalization,
      peRatio: data.PERatio,
      pegRatio: data.PEGRatio,
      priceToBook: data.PriceToBookRatio,
      eps: data.EPS,
      revenueGrowthYoY: data.QuarterlyRevenueGrowthYOY,
      profitMargin: data.ProfitMargin,
      debtToEquity: data.DebtToEquityRatio,
      returnOnEquity: data.ReturnOnEquityTTM,
      dividendYield: data.DividendYield,
      week52High: data['52WeekHigh'],
      week52Low: data['52WeekLow'],
      analystTarget: data.AnalystTargetPrice,
      exchange: data.Exchange,
      currency: data.Currency,
    };
  } catch {
    return mockCompanyOverview(symbol);
  }
}

export async function fetchPriceData(symbol: string, apiKey?: string): Promise<PriceData> {
  const activeKey = apiKey || AV_KEY;
  if (activeKey === 'demo') return mockPriceData();
  try {
    const data = await rateLimitedFetch(
      `${AV_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${activeKey}`
    ) as Record<string, Record<string, string>>;
    const q = data['Global Quote'];
    if (!q || !q['05. price']) return mockPriceData();
    return {
      currentPrice: parseFloat(q['05. price']),
      previousClose: parseFloat(q['08. previous close']),
      change: parseFloat(q['09. change']),
      changePercent: parseFloat(q['10. change percent'].replace('%', '')),
      volume: q['06. volume'],
    };
  } catch {
    return mockPriceData();
  }
}

export async function fetchNews(symbol: string, companyName: string, apiKey?: string): Promise<NewsItem[]> {
  const activeKey = apiKey || process.env.NEWS_API_KEY;
  if (!activeKey) return mockNews(symbol);
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}&sortBy=publishedAt&pageSize=5&apiKey=${activeKey}`;
    const data = await rateLimitedFetch(url) as { articles: Array<{
      title: string; description: string; url: string; source: { name: string }; publishedAt: string;
    }>; status: string };
    if (data.status !== 'ok') return mockNews(symbol);
    return data.articles.map(a => ({
      title: a.title,
      summary: a.description || '',
      url: a.url,
      source: a.source.name,
      publishedAt: a.publishedAt,
      sentiment: 'Neutral',
      relevanceScore: 0.7,
    }));
  } catch {
    return mockNews(symbol);
  }
}

// Alpha Vantage symbol search
export async function searchSymbol(query: string, apiKey?: string): Promise<{ symbol: string; name: string }[]> {
  const activeKey = apiKey || AV_KEY;
  if (activeKey === 'demo') {
    const common: Record<string, string> = {
      apple: 'AAPL', tesla: 'TSLA', nvidia: 'NVDA', microsoft: 'MSFT',
      google: 'GOOGL', alphabet: 'GOOGL', amazon: 'AMZN', meta: 'META',
      netflix: 'NFLX', berkshire: 'BRK.B', jpmorgan: 'JPM', johnson: 'JNJ',
      walmart: 'WMT', visa: 'V', mastercard: 'MA', paypal: 'PYPL',
      salesforce: 'CRM', adobe: 'ADBE', intel: 'INTC', amd: 'AMD',
    };
    const lq = query.toLowerCase();
    const found = Object.entries(common).find(([k]) => lq.includes(k));
    if (found) return [{ symbol: found[1], name: query }];
    return [{ symbol: query.toUpperCase(), name: query }];
  }
  try {
    const data = await rateLimitedFetch(
      `${AV_BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${activeKey}`
    ) as { bestMatches: Array<{ '1. symbol': string; '2. name': string }> };
    return (data.bestMatches || []).slice(0, 3).map(m => ({
      symbol: m['1. symbol'],
      name: m['2. name'],
    }));
  } catch {
    return [{ symbol: query.toUpperCase(), name: query }];
  }
}
