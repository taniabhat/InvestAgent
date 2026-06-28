# InvestIQ — AI Investment Research Agent

> Enter a company name or ticker. Get a data-backed **INVEST** or **PASS** verdict in under 60 seconds.

Built for the InsideIIM × Altuni AI Labs take-home assignment. Uses **Next.js 14**, **LangChain.js**, and real financial data APIs to run a multi-step AI research pipeline on any publicly traded company.

---

## Overview

InvestIQ is a full-stack Next.js application that implements a multi-step LangChain agent for equity research:

1. **Symbol resolution** — maps company name → stock ticker (Alpha Vantage search)
2. **Data ingestion** — fetches fundamentals, price data, and recent news in parallel
3. **Fundamental analysis** — LLM evaluates valuation, profitability, growth, and balance sheet
4. **Sentiment analysis** — LLM scores news sentiment and identifies catalysts/risks
5. **Decision synthesis** — LLM produces a structured JSON verdict: `INVEST` or `PASS`, with confidence score, reasoning chain, key strengths/risks, valuation verdict, and source links

---

## How to Run

### Prerequisites
- Node.js 18+
- An OpenAI or Anthropic API key

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Edit .env.local and add your keys (see below)
# At minimum: OPENAI_API_KEY (or ANTHROPIC_API_KEY)

# 4. Start development server
npm run dev

# App runs at http://localhost:3000
```

### Environment Variables (`.env.local`)

```env
# Pick one LLM provider
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# Which provider to use: "openai" | "anthropic"
LLM_PROVIDER=openai

# Free Alpha Vantage key (get at https://www.alphavantage.co/support/#api-key)
# Without a real key, the app uses built-in mock data for AAPL, TSLA, NVDA
ALPHA_VANTAGE_KEY=demo

# Optional: news headlines (get at https://newsapi.org/)
# NEWS_API_KEY=...

# Rate limit: requests per minute (default 10)
RATE_LIMIT_RPM=10
```

**No ALPHA_VANTAGE_KEY needed to run** — `demo` mode uses realistic built-in mock data.  
**Only the LLM API key is required** to get real AI analysis.

### Production Build

```bash
npm run build && npm start
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Client (React/Next.js)                 │
│                                                          │
│   SearchPanel → POST /api/analyze → LoadingPanel        │
│                                    ↓                    │
│                              ReportPanel                 │
│   (Decision banner, reasoning chain, strengths/risks,    │
│    valuation, sentiment, source links)                   │
└──────────────────────────────────────────────────────────┘
                           │
                  Next.js API Route
                  /api/analyze (POST)
                           │
┌──────────────────────────────────────────────────────────┐
│              Investment Agent (LangChain.js)             │
│                                                          │
│  Step 1: searchSymbol()      ← Alpha Vantage search     │
│  Step 2: [parallel fetch]                               │
│    ├─ fetchCompanyOverview() ← Alpha Vantage OVERVIEW   │
│    ├─ fetchPriceData()       ← Alpha Vantage QUOTE      │
│    └─ fetchNews()            ← NewsAPI (or mock)        │
│                                                          │
│  Step 3: FUNDAMENTALS_PROMPT → LLM → text analysis      │
│  Step 4: SENTIMENT_PROMPT   → LLM → text analysis      │
│  Step 5: DECISION_PROMPT    → LLM → JSON verdict       │
│                                                          │
│  Returns: InvestmentReport (JSON)                       │
└──────────────────────────────────────────────────────────┘
```

### Key files

| Path | Purpose |
|---|---|
| `app/page.tsx` | Root client component, orchestrates state |
| `app/api/analyze/route.ts` | Server-side API endpoint (POST) |
| `lib/agents/investmentAgent.ts` | LangChain 3-step pipeline |
| `lib/fetchers/financial.ts` | Alpha Vantage + NewsAPI fetchers with mock fallback |
| `components/ReportPanel.tsx` | Full report UI |
| `components/LoadingPanel.tsx` | Animated step-by-step loading |
| `components/SearchPanel.tsx` | Input bar |

---

## How It Works — LangChain Pipeline

The agent uses **three sequential LLM calls** (not a single monolithic prompt), making each step independently auditable:

### Prompt 1 — Fundamental Analysis
Sends raw financial metrics to the LLM. Asks it to reason about valuation vs sector peers, profitability quality, growth trajectory, and balance sheet health. Returns a 200-300 word analysis.

### Prompt 2 — Sentiment Analysis
Sends recent news headlines and summaries. Asks it to score overall sentiment, identify bullish catalysts, and flag bearish structural risks.

### Prompt 3 — Investment Decision (JSON)
Combines both analyses with a metrics summary. Returns a strictly structured JSON object:
- `decision`: `"INVEST"` or `"PASS"`
- `confidence`: 0–100
- `summary`: executive summary
- `steps[]`: reasoning chain with per-step signal and confidence
- `keyStrengths[]` / `keyRisks[]`
- `valuation.verdict`: Undervalued / Fairly Valued / Overvalued
- `sentiment.overall`: Bullish / Bearish / Neutral / Mixed

---

## Key Decisions & Trade-offs

### What I chose

**Three-prompt chain over single-prompt or tool-calling agent**  
A tool-calling agent (with `AgentExecutor`) adds latency and unpredictability for time-boxed demos. Three sequential prompts — fundamentals → sentiment → decision — are easier to debug, cheaper to run, and produce consistent JSON. The tradeoff: it can't self-correct mid-chain if data is sparse.

**Alpha Vantage (free tier) + mock fallback**  
AV's free tier covers 25 requests/day at standard rate — enough for demos. The mock system ensures the app is always runnable without any data API key, which matters for reviewers. Real deployments should use a paid AV plan or switch to a commercial data provider.

**Next.js App Router (server components + API routes)**  
Keeps the architecture simple: one repo, one deploy. The API route runs server-side (no CORS issues, keeps API keys secret), the React client handles streaming feedback via polling state.

**In-memory rate limiter**  
Simple and zero-dependency. The tradeoff: doesn't persist across serverless function instances. For production, use Redis-based rate limiting (e.g. Upstash).

**OpenAI `gpt-4o-mini` as default**  
Fastest and cheapest LLM that can reliably produce structured JSON. For deeper analysis, swap to `gpt-4o` or `claude-sonnet-4-6` via the `LLM_PROVIDER` env var.

### What I left out

- **Historical price chart** — would add YFinance or Twelve Data integration
- **DCF valuation model** — requires more granular financials than AV free tier provides
- **WebSocket streaming** — would make the AI output stream token-by-token into the UI
- **Caching layer** — repeated queries for the same ticker hit the LLM every time; Redis TTL cache would reduce cost
- **User accounts / portfolio tracking** — out of scope for MVP

---

## Example Runs

### Apple (AAPL) — INVEST

```
Company: Apple Inc. (AAPL)
Decision: INVEST | Confidence: 78/100

Summary: Apple demonstrates strong profitability with 25.3% margins and a robust
ecosystem moat. While the P/E of 31.2x is elevated vs historical averages, the
PEG of 2.8 and consistent buybacks justify a premium. Recommend invest on dips.

Steps:
  01. Valuation       → NEUTRAL   | P/E 31.2x is above S&P median but justified by quality
  02. Profitability   → BULLISH   | 25.3% net margin, ROE 147% — exceptional capital efficiency
  03. Growth          → NEUTRAL   | Revenue growth +2.4% YoY — slowing but Services accelerating
  04. Risk/Debt       → NEUTRAL   | D/E 151 looks high but backed by $60B+ cash
  05. Market Sentiment→ BULLISH   | Analyst consensus bullish, target $210 vs $195 current

Key Strengths: Ecosystem lock-in, Services growth, buyback program, brand pricing power
Key Risks: China revenue concentration, iPhone saturation, regulatory antitrust scrutiny
Valuation: Fairly Valued — priced for quality, limited upside at current levels
```

### Tesla (TSLA) — PASS

```
Company: Tesla Inc. (TSLA)
Decision: PASS | Confidence: 71/100

Summary: Tesla's P/E of 58x is difficult to justify given decelerating revenue growth
(+1.9% YoY) and intensifying EV competition from Chinese OEMs. Margins are compressing.
Pass until there's evidence of a new growth catalyst.

Steps:
  01. Valuation       → BEARISH   | P/E 58x vs auto industry 8-12x — extreme premium
  02. Profitability   → NEUTRAL   | 7.4% margin declining YoY due to price cuts
  03. Growth          → BEARISH   | Revenue growth near-flat despite volume increases
  04. Risk/Debt       → BULLISH   | Low D/E of 18, strong cash position
  05. Market Sentiment→ BEARISH   | Mixed news; analyst targets range $150–$300 wide disagreement

Key Strengths: Balance sheet, Supercharger network, energy storage growth
Key Risks: Valuation premium, competitive pressure, CEO distraction, margin compression
Valuation: Overvalued — priced for 20%+ growth; reality is sub-2% YoY
```

### NVIDIA (NVDA) — INVEST

```
Company: NVIDIA Corporation (NVDA)
Decision: INVEST | Confidence: 84/100

Summary: NVIDIA is the infrastructure backbone of the AI supercycle. Revenue grew
218% YoY, margins are 55%, and the data center TAM is still in early innings. 
P/E of 65x is high but PEG of 1.8 signals the growth more than compensates.

Steps:
  01. Valuation       → NEUTRAL   | P/E 65x expensive but PEG 1.8 is below 2.0 threshold
  02. Profitability   → BULLISH   | 55.2% net margin — software-like economics in hardware
  03. Growth          → BULLISH   | +218% YoY revenue — structural AI demand, not cyclical
  04. Risk/Debt       → BULLISH   | D/E 42 manageable; ROE 124%
  05. Market Sentiment→ BULLISH   | Analyst consensus strong buy; supply constraints = demand signal

Key Strengths: CUDA ecosystem moat, H100/H200 demand, software margin expansion
Key Risks: Customer concentration (hyperscalers), China export restrictions, AMD competition
Valuation: Fairly Valued on growth-adjusted basis; expensive on trailing multiples
```

---

## What I Would Improve With More Time

1. **Streaming responses** — Stream LLM tokens to the UI so users see analysis appear word-by-word rather than waiting for all three prompts to complete
2. **LangGraph agent** — Rewrite as a proper LangGraph state machine with conditional edges (e.g., if P/E is N/A, branch to a different analysis path)
3. **Historical chart** — Add a 1Y/5Y price chart using Recharts + TwelveData API
4. **DCF model** — Pull income statement history from AV and run a simple discounted cash flow model as a fourth analysis step
5. **Redis caching** — Cache analysis results for 15 minutes per ticker to reduce LLM costs
6. **Comparison mode** — Analyze two tickers side by side
7. **Portfolio screener** — Batch-analyze a watchlist and rank by AI confidence score

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set env vars in Vercel dashboard or via CLI:
vercel env add OPENAI_API_KEY
vercel env add ALPHA_VANTAGE_KEY
vercel env add LLM_PROVIDER
```

The `maxDuration = 60` on the API route is already set for Vercel's hobby plan limit.

---

## Local Mock Mode

If you have no API keys at all, the app still runs in full mock mode:
- Financial data is served from hardcoded mock objects (AAPL, TSLA, NVDA; any other ticker gets generic values)
- **Only the LLM API key is needed** for real AI analysis

To test UI without an LLM key, you can hit the API directly with a fake response to verify frontend rendering.

---

*Built by Tania | InsideIIM × Altuni AI Labs Assignment*
