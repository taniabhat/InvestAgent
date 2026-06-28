// app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runInvestmentAgent } from '@/lib/agents/investmentAgent';

export const maxDuration = 60; // 60s for Vercel

export async function POST(req: NextRequest) {
  try {
    const { company, settings } = await req.json();
    if (!company || typeof company !== 'string' || company.trim().length === 0) {
      return NextResponse.json({ error: 'Company name or ticker is required.' }, { status: 400 });
    }
    const report = await runInvestmentAgent(company.trim(), settings);
    return NextResponse.json(report);
  } catch (err: unknown) {
    console.error('[analyze] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
