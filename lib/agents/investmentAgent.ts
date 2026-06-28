// lib/agents/investmentAgent.ts
// LangChain-powered multi-step research + decision agent

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { z } from 'zod';
import {
  fetchCompanyOverview,
  fetchPriceData,
  fetchNews,
  searchSymbol,
  CompanyOverview,
  PriceData,
  NewsItem,
  mockCompanyOverview,
  mockPriceData,
  mockNews,
} from '../fetchers/financial';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResearchData {
  symbol: string;
  companyName: string;
  overview: CompanyOverview;
  price: PriceData;
  news: NewsItem[];
}

export interface AnalysisStep {
  step: string;
  finding: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
}

export interface FinancialYearData {
  year: string;
  revenue: number;    // In billions USD
  netIncome: number;  // In billions USD
}

export interface InvestmentReport {
  companyName: string;
  symbol: string;
  decision: 'INVEST' | 'PASS';
  confidence: number; // 0-100
  summary: string;
  steps: AnalysisStep[];
  keyRisks: string[];
  keyStrengths: string[];
  valuation: {
    verdict: string;
    details: string;
  };
  sentiment: {
    overall: 'Bullish' | 'Bearish' | 'Neutral' | 'Mixed';
    newsHighlights: string[];
  };
  sources: Array<{ label: string; url: string }>;
  dataMode: 'live' | 'demo' | 'synthesized';
  generatedAt: string;
  historicalFinancials: FinancialYearData[];
  currentPrice?: number;
  changePercent?: number;
}

// ── LLM factory ───────────────────────────────────────────────────────────

function getLLM(settings?: any) {
  const provider = settings?.llmProvider || process.env.LLM_PROVIDER || 'openai';
  const apiKey = settings?.llmApiKey || (
    provider === 'openai' ? process.env.OPENAI_API_KEY :
    provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY :
    provider === 'groq' ? process.env.GROQ_API_KEY :
    provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : undefined
  );

  if (provider === 'anthropic') {
    return new ChatAnthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      model: settings?.llmModel || process.env.LLM_MODEL || 'claude-sonnet-4-6',
      temperature: 0.3,
      maxTokens: 4096,
    });
  }
  if (provider === 'groq') {
    return new ChatOpenAI({
      apiKey: apiKey || process.env.GROQ_API_KEY,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
      model: settings?.llmModel || process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.3,
      maxTokens: 4096,
    });
  }
  if (provider === 'openrouter') {
    return new ChatOpenAI({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
      },
      model: settings?.llmModel || process.env.LLM_MODEL || 'google/gemma-2-9b-it:free',
      temperature: 0.3,
      maxTokens: 4096,
    });
  }
  return new ChatOpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
    model: settings?.llmModel || process.env.LLM_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 4096,
  });
}

// ── Fallback Synthesizer Prompt ──────────────────────────────────────────

const SYNTHESIZE_COMPANY_DATA_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a senior financial research assistant. Synthesize realistic, current (as of 2026 or recent data) financial metrics, company profile, and price details for the company requested.
If it is a public company, use your knowledge of its true financial metrics.
If it is a private company, estimate its valuation (set as market cap), status, and recent financials realistically.

Company Name or Ticker requested: {companyInput}
Resolved Ticker Symbol: {symbol}

Respond with a JSON object in this EXACT format (no markdown backticks, no other text, just the raw JSON):
{{
  "overview": {{
    "symbol": "{symbol}",
    "name": "<full official company name, e.g. Microsoft Corporation>",
    "description": "<detailed description of the company, its products, services, and business model - about 100-150 words>",
    "sector": "<sector, e.g. Technology, Consumer Cyclical, Healthcare, Financials, etc.>",
    "industry": "<industry, e.g. Semiconductors, Software, Biotechnology, Auto Manufacturers, etc.>",
    "marketCap": "<market cap in USD, as a raw number string, e.g. 3200000000000>",
    "peRatio": "<P/E ratio, e.g. 35.4 or N/A>",
    "pegRatio": "<PEG ratio, e.g. 2.1 or N/A>",
    "priceToBook": "<P/B ratio, e.g. 12.8 or N/A>",
    "eps": "<Earnings Per Share, e.g. 6.25 or N/A>",
    "revenueGrowthYoY": "<YoY revenue growth as a decimal string, e.g. 0.12 or N/A>",
    "profitMargin": "<profit margin as a decimal string, e.g. 0.22 or N/A>",
    "debtToEquity": "<debt/equity ratio as a percentage/number string, e.g. 85 or N/A>",
    "returnOnEquity": "<return on equity as a decimal string, e.g. 0.28 or N/A>",
    "dividendYield": "<dividend yield as a decimal string, e.g. 0.008 or 0>",
    "week52High": "<52-week high price, e.g. 420.50>",
    "week52Low": "<52-week low price, e.g. 310.20>",
    "analystTarget": "<analyst target price, e.g. 450.00>",
    "exchange": "<exchange, e.g. NASDAQ, NYSE, Private, NSE, etc.>",
    "currency": "USD"
  }},
  "price": {{
    "currentPrice": <current stock price or valuation per share as a number, e.g. 415.20>,
    "previousClose": <previous close price as a number, e.g. 410.50>,
    "change": <change as a number, e.g. 4.70>,
    "changePercent": <change percent as a number, e.g. 1.15>,
    "volume": "<daily volume as a number string, e.g. 25000000>"
  }},
  "news": [
    {{
      "title": "<recent news headline 1>",
      "summary": "<news summary 1>",
      "url": "https://finance.yahoo.com",
      "source": "<source name, e.g. Bloomberg, Reuters, TechCrunch>",
      "publishedAt": "2026-06-23T12:00:00Z",
      "sentiment": "Bullish|Bearish|Neutral",
      "relevanceScore": 0.95
    }},
    {{
      "title": "<recent news headline 2>",
      "summary": "<news summary 2>",
      "url": "https://finance.yahoo.com",
      "source": "<source name>",
      "publishedAt": "2026-06-22T14:30:00Z",
      "sentiment": "Bullish|Bearish|Neutral",
      "relevanceScore": 0.85
    }},
    {{
      "title": "<recent news headline 3>",
      "summary": "<news summary 3>",
      "url": "https://finance.yahoo.com",
      "source": "<source name>",
      "publishedAt": "2026-06-21T09:15:00Z",
      "sentiment": "Bullish|Bearish|Neutral",
      "relevanceScore": 0.75
    }}
  ]
}}
`);

// ── Prompt templates ───────────────────────────────────────────────────────

const FUNDAMENTALS_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a senior equity research analyst. Analyze the fundamentals of {companyName} ({symbol}).

COMPANY DATA:
- Sector: {sector} | Industry: {industry}
- Market Cap: {marketCap}
- P/E Ratio: {peRatio} | PEG Ratio: {pegRatio} | P/B Ratio: {priceToBook}
- EPS: {eps} | Profit Margin: {profitMargin}
- Revenue Growth YoY: {revenueGrowthYoY}
- Debt/Equity: {debtToEquity} | ROE: {returnOnEquity}
- Dividend Yield: {dividendYield}
- 52-Week Range: {week52Low} – {week52High}
- Analyst Target Price: {analystTarget}
- Current Price: {currentPrice} (Change: {changePercent}%)

HISTORICAL FINANCIAL TREND (5-Year):
{historicalTrend}

Business Description:
{description}

Provide a concise fundamental analysis covering:
1. Valuation (cheap/fair/expensive based on sector peers)
2. Profitability quality
3. Growth trajectory — CRITICALLY assess whether revenue or net income are declining, stalling, or accelerating based on the historical trend data above. If the trend is declining or flattening, explicitly flag this.
4. Balance sheet health
5. Overall fundamental signal (Bullish/Bearish/Neutral)

IMPORTANT: Weight the historical trend heavily. A company with declining or stagnating revenue/income should NOT receive a bullish growth signal regardless of other metrics.

Be specific, data-driven, and concise (200-300 words).
`);

const SENTIMENT_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a market sentiment analyst. Analyze news sentiment for {companyName} ({symbol}).

RECENT NEWS:
{newsText}

Assess:
1. Overall sentiment (Bullish / Bearish / Neutral / Mixed)
2. Key bullish catalysts
3. Key bearish risks
4. Credibility of news sources
5. Time horizon of sentiment (short-term vs structural)

Be concise (150-200 words).
`);

const DECISION_PROMPT = ChatPromptTemplate.fromTemplate(`
You are a portfolio manager making a final investment decision on {companyName} ({symbol}).

FUNDAMENTAL ANALYSIS:
{fundamentalAnalysis}

SENTIMENT ANALYSIS:
{sentimentAnalysis}

HISTORICAL FINANCIAL TREND (5-Year):
{historicalTrend}

KEY METRICS SUMMARY:
- Decision Framework: Value + Growth + Sentiment composite
- P/E: {peRatio} | PEG: {pegRatio} | P/B: {priceToBook}
- Profit Margin: {profitMargin} | ROE: {returnOnEquity}
- Revenue Growth: {revenueGrowthYoY}
- Debt/Equity: {debtToEquity}
- Price vs Analyst Target: {currentPrice} vs {analystTarget}
- Sector: {sector}

CRITICAL DECISION RULES:
- If the historical trend shows DECLINING revenue or net income over recent years, this is a major bearish signal. Factor this heavily.
- If revenue has stalled or net income has dropped, the decision should lean toward PASS unless there are very strong offsetting factors.
- The confidence level must reflect the overall consistency of signals. Contradictory signals (e.g. good valuation but declining financials) should result in LOWER confidence.
- Ensure your decision is CONSISTENT with the data trends shown above. Do not recommend INVEST with high confidence if key financial metrics are deteriorating.

Provide your investment decision in this EXACT JSON format (no markdown, no extra text):
{{
  "decision": "INVEST" or "PASS",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence executive summary of the decision>",
  "steps": [
    {{"step": "<analysis dimension>", "finding": "<specific finding>", "signal": "bullish|bearish|neutral", "confidence": <0.0-1.0>}},
    ...
  ],
  "keyStrengths": ["<strength 1>", "<strength 2>", ...],
  "keyRisks": ["<risk 1>", "<risk 2>", ...],
  "valuation": {{
    "verdict": "Undervalued|Fairly Valued|Overvalued",
    "details": "<brief valuation rationale>"
  }},
  "sentiment": {{
    "overall": "Bullish|Bearish|Neutral|Mixed",
    "newsHighlights": ["<highlight 1>", "<highlight 2>"]
  }}
}}

Include at least 5 steps covering: Valuation, Profitability, Growth Trajectory, Risk/Debt, and Market Sentiment. The Growth Trajectory step MUST reference the historical trend data.
`);

// ── Helper: format market cap ──────────────────────────────────────────────

function formatMarketCap(cap: string): string {
  const n = parseFloat(cap);
  if (isNaN(n)) return cap;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPercent(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  return `${(n * 100).toFixed(1)}%`;
}

// ── Helper: generate 5-year financials for charts ──────────────────────────

function getHistoricalFinancials(symbol: string, overview: any): FinancialYearData[] {
  const sym = symbol.toUpperCase();
  if (sym === 'AAPL') {
    return [
      { year: '2020', revenue: 274.5, netIncome: 57.4 },
      { year: '2021', revenue: 365.8, netIncome: 94.7 },
      { year: '2022', revenue: 394.3, netIncome: 99.8 },
      { year: '2023', revenue: 383.3, netIncome: 97.0 },
      { year: '2024', revenue: 391.0, netIncome: 93.7 },
    ];
  }
  if (sym === 'TSLA') {
    return [
      { year: '2020', revenue: 31.5, netIncome: 0.7 },
      { year: '2021', revenue: 53.8, netIncome: 5.5 },
      { year: '2022', revenue: 81.5, netIncome: 12.6 },
      { year: '2023', revenue: 96.8, netIncome: 15.0 },
      { year: '2024', revenue: 96.7, netIncome: 13.4 },
    ];
  }
  if (sym === 'NVDA') {
    return [
      { year: '2020', revenue: 16.7, netIncome: 4.3 },
      { year: '2021', revenue: 26.9, netIncome: 9.7 },
      { year: '2022', revenue: 27.0, netIncome: 4.4 },
      { year: '2023', revenue: 60.9, netIncome: 29.7 },
      { year: '2024', revenue: 96.3, netIncome: 53.0 },
    ];
  }

  // Dynamic projection for other tickers
  const parsedCap = parseFloat(overview.marketCap);
  const baseRevenue = isNaN(parsedCap) || parsedCap <= 0 ? 45.0 : parsedCap / 12 / 1e9; // ballpark proxy in billions
  const growthRate = parseFloat(overview.revenueGrowthYoY);
  const actualGrowth = isNaN(growthRate) ? 0.08 : growthRate;
  const margin = parseFloat(overview.profitMargin);
  const actualMargin = isNaN(margin) || margin <= 0 ? 0.12 : margin;

  const years = ['2020', '2021', '2022', '2023', '2024'];
  const financials: FinancialYearData[] = [];

  let rev = baseRevenue / Math.pow(1 + actualGrowth, 4);
  for (let i = 0; i < 5; i++) {
    const calculatedRevenue = parseFloat(rev.toFixed(2));
    const calculatedNetIncome = parseFloat((rev * actualMargin).toFixed(2));
    financials.push({
      year: years[i],
      revenue: calculatedRevenue > 0 ? calculatedRevenue : 1.0,
      netIncome: calculatedNetIncome > 0 ? calculatedNetIncome : 0.1,
    });
    // Add small variation to the growth path
    rev *= (1 + actualGrowth + (Math.random() - 0.5) * 0.03);
  }

  return financials;
}

// ── Main agent function ────────────────────────────────────────────────────

export async function runInvestmentAgent(companyInput: string, settings?: any): Promise<InvestmentReport> {
  // 1. Resolve symbol
  const avApiKey = settings?.alphaVantageApiKey || process.env.ALPHA_VANTAGE_KEY;
  const newsApiKey = settings?.newsApiKey || process.env.NEWS_API_KEY;

  const matches = await searchSymbol(companyInput, avApiKey);
  const { symbol, name } = matches[0] || { symbol: companyInput.toUpperCase(), name: companyInput };

  // 2. Fetch all data in parallel
  let overview: CompanyOverview;
  let price: PriceData;
  let news: NewsItem[];

  try {
    const [fetchedOverview, fetchedPrice, fetchedNews] = await Promise.all([
      fetchCompanyOverview(symbol, avApiKey),
      fetchPriceData(symbol, avApiKey),
      fetchNews(symbol, name, newsApiKey),
    ]);
    overview = fetchedOverview;
    price = fetchedPrice;
    news = fetchedNews;
  } catch (err) {
    console.error('Failed to fetch financial data, falling back to mock:', err);
    overview = mockCompanyOverview(symbol);
    price = mockPriceData();
    news = mockNews(symbol);
  }

  let companyName = overview.name || name;
  let dataMode: 'live' | 'demo' | 'synthesized' = (avApiKey && avApiKey !== 'demo') ? 'live' : 'demo';

  // Check if data is dummy fallback
  const isDummy =
    (!['AAPL', 'TSLA', 'NVDA'].includes(symbol) &&
      (overview.sector === 'Unknown' || overview.marketCap === '0' || overview.description.includes('No description available'))) ||
    (settings?.demoMode === true);

  if (isDummy) {
    try {
      const llmSynth = getLLM(settings);
      const synthParser = new StringOutputParser();
      const synthChain = RunnableSequence.from([SYNTHESIZE_COMPANY_DATA_PROMPT, llmSynth, synthParser]);
      
      const synthResultText = await synthChain.invoke({
        companyInput,
        symbol,
      });
      
      const cleanSynth = synthResultText.replace(/```json|```/g, '').trim();
      const parsedSynth = JSON.parse(cleanSynth);
      
      if (parsedSynth.overview && parsedSynth.price) {
        overview = parsedSynth.overview;
        price = parsedSynth.price;
        news = parsedSynth.news || news;
        companyName = overview.name;
        dataMode = 'synthesized';
      }
    } catch (synthErr) {
      console.error('Failed to synthesize company data using LLM fallback:', synthErr);
      // Continue with original dummy overview
    }
  }

  // 3. LLM chain
  const llm = getLLM(settings);
  const parser = new StringOutputParser();

  // Pre-compute historical financials so we can feed the trend into the LLM
  const historicalFinancials = getHistoricalFinancials(symbol, overview);

  // Format historical trend as a readable summary for the LLM
  const historicalTrend = historicalFinancials.map((f, i, arr) => {
    let trend = '';
    if (i > 0) {
      const revChange = ((f.revenue - arr[i - 1].revenue) / arr[i - 1].revenue * 100).toFixed(1);
      const niChange = ((f.netIncome - arr[i - 1].netIncome) / arr[i - 1].netIncome * 100).toFixed(1);
      trend = ` (Revenue YoY: ${parseFloat(revChange) >= 0 ? '+' : ''}${revChange}%, Net Income YoY: ${parseFloat(niChange) >= 0 ? '+' : ''}${niChange}%)`;
    }
    return `${f.year}: Revenue $${f.revenue.toFixed(1)}B, Net Income $${f.netIncome.toFixed(1)}B${trend}`;
  }).join('\n');

  // Compute overall trend direction
  const latestRev = historicalFinancials[historicalFinancials.length - 1]?.revenue || 0;
  const prevRev = historicalFinancials[historicalFinancials.length - 2]?.revenue || 0;
  const latestNI = historicalFinancials[historicalFinancials.length - 1]?.netIncome || 0;
  const prevNI = historicalFinancials[historicalFinancials.length - 2]?.netIncome || 0;
  const trendSummary = `\nTREND ASSESSMENT: Revenue ${latestRev >= prevRev ? (latestRev > prevRev * 1.02 ? 'GROWING' : 'FLAT/STAGNATING') : 'DECLINING'}, Net Income ${latestNI >= prevNI ? (latestNI > prevNI * 1.02 ? 'GROWING' : 'FLAT/STAGNATING') : 'DECLINING'}`;
  const fullHistoricalTrend = historicalTrend + trendSummary;

  // Step A: Fundamental analysis
  const fundamentalChain = RunnableSequence.from([FUNDAMENTALS_PROMPT, llm, parser]);
  const fundamentalAnalysis = await fundamentalChain.invoke({
    companyName,
    symbol,
    sector: overview.sector,
    industry: overview.industry,
    marketCap: formatMarketCap(overview.marketCap),
    peRatio: overview.peRatio,
    pegRatio: overview.pegRatio,
    priceToBook: overview.priceToBook,
    eps: overview.eps,
    profitMargin: overview.profitMargin !== 'N/A' ? formatPercent(overview.profitMargin) : 'N/A',
    revenueGrowthYoY: overview.revenueGrowthYoY !== 'N/A' ? formatPercent(overview.revenueGrowthYoY) : 'N/A',
    debtToEquity: overview.debtToEquity,
    returnOnEquity: overview.returnOnEquity !== 'N/A' ? formatPercent(overview.returnOnEquity) : 'N/A',
    dividendYield: overview.dividendYield !== 'N/A' ? formatPercent(overview.dividendYield) : '0%',
    week52Low: overview.week52Low,
    week52High: overview.week52High,
    analystTarget: overview.analystTarget,
    currentPrice: price.currentPrice.toString(),
    changePercent: price.changePercent.toString(),
    description: overview.description?.slice(0, 600) || 'N/A',
    historicalTrend: fullHistoricalTrend,
  });

  // Step B: Sentiment analysis
  const newsText = news.map((n, i) =>
    `${i + 1}. [${n.source}] ${n.title}\n   ${n.summary}`
  ).join('\n\n');

  const sentimentChain = RunnableSequence.from([SENTIMENT_PROMPT, llm, parser]);
  const sentimentAnalysis = await sentimentChain.invoke({ companyName, symbol, newsText });

  // Step C: Final decision (JSON)
  const decisionChain = RunnableSequence.from([DECISION_PROMPT, llm, parser]);
  const decisionRaw = await decisionChain.invoke({
    companyName,
    symbol,
    fundamentalAnalysis,
    sentimentAnalysis,
    historicalTrend: fullHistoricalTrend,
    peRatio: overview.peRatio,
    pegRatio: overview.pegRatio,
    priceToBook: overview.priceToBook,
    profitMargin: overview.profitMargin !== 'N/A' ? formatPercent(overview.profitMargin) : 'N/A',
    returnOnEquity: overview.returnOnEquity !== 'N/A' ? formatPercent(overview.returnOnEquity) : 'N/A',
    revenueGrowthYoY: overview.revenueGrowthYoY !== 'N/A' ? formatPercent(overview.revenueGrowthYoY) : 'N/A',
    debtToEquity: overview.debtToEquity,
    currentPrice: price.currentPrice.toString(),
    analystTarget: overview.analystTarget,
    sector: overview.sector,
  });

  // Parse JSON decision
  let decision: Omit<InvestmentReport, 'companyName' | 'symbol' | 'sources' | 'dataMode' | 'generatedAt' | 'historicalFinancials'>;
  try {
    const clean = decisionRaw.replace(/```json|```/g, '').trim();
    decision = JSON.parse(clean);
  } catch {
    // Fallback if JSON parsing fails
    decision = {
      decision: 'PASS',
      confidence: 50,
      summary: 'Analysis completed. Unable to parse structured decision — please review manually.',
      steps: [
        { step: 'Fundamental Analysis', finding: fundamentalAnalysis.slice(0, 200), signal: 'neutral', confidence: 0.5 },
        { step: 'Sentiment Analysis', finding: sentimentAnalysis.slice(0, 200), signal: 'neutral', confidence: 0.5 },
      ],
      keyStrengths: ['See fundamental analysis above'],
      keyRisks: ['See sentiment analysis above'],
      valuation: { verdict: 'Fairly Valued', details: 'Manual review required' },
      sentiment: { overall: 'Neutral', newsHighlights: news.slice(0, 2).map(n => n.title) },
    };
  }

  // Build sources list
  const sources = [
    { label: `Alpha Vantage — ${symbol} Overview`, url: `https://www.alphavantage.co/` },
    { label: `Yahoo Finance — ${symbol}`, url: `https://finance.yahoo.com/quote/${symbol}` },
    { label: `SEC EDGAR — ${companyName}`, url: `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(companyName)}&dateRange=custom&startdt=2024-01-01` },
    ...news.slice(0, 3).map(n => ({ label: n.title.slice(0, 60), url: n.url })),
  ];

  return {
    companyName,
    symbol,
    ...decision,
    sources,
    dataMode,
    generatedAt: new Date().toISOString(),
    historicalFinancials,
    currentPrice: price.currentPrice,
    changePercent: price.changePercent,
  };
}
