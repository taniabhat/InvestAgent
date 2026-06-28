// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    llmProvider: process.env.LLM_PROVIDER || 'openai',
    dataMode: (process.env.ALPHA_VANTAGE_KEY || 'demo') === 'demo' ? 'demo' : 'live',
    timestamp: new Date().toISOString(),
  });
}
