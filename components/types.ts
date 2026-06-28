// components/types.ts

export interface AnalysisStep {
  step: string;
  finding: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
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
  confidence: number;
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
