# LLM Chat Session Transcript
## InvestIQ Build Log — AI-Assisted Development

This log documents the LLM chat sessions used while building InvestIQ.
Each session covers a distinct build phase.

---

## Session 1 — Architecture Planning

**Me:** I need to build an AI investment research agent as a take-home assignment. Tech stack is React or Next.js, Node.js or Next.js API routes, and LangChain.js or LangGraph.js. It should take a company name, do research, and output an invest/pass decision with reasoning. How should I structure this?

**Claude:** For this assignment, I'd go with Next.js App Router — it gives you both the React frontend and Node.js API routes in a single project, which is perfect for a solo demo.

Here's the architecture I'd recommend:

```
Client (React) → POST /api/analyze → LangChain Agent → Financial APIs → LLM → JSON Report
```

For the AI pipeline, I'd use three sequential LLM calls rather than a full LangGraph agent — it's simpler, cheaper, and easier to debug within a 7-day window:

1. **Fundamentals prompt** → analyze P/E, margins, growth, debt
2. **Sentiment prompt** → analyze news headlines
3. **Decision prompt** → synthesize into a structured JSON verdict

For data, Alpha Vantage has a free tier that covers company overviews and quotes. Add NewsAPI for headlines.

**Me:** Should I use LangGraph or just LangChain chains?

**Claude:** For this scope, LangChain `RunnableSequence` chains are cleaner. LangGraph shines when you need conditional branching (e.g., "if earnings data unavailable, take alternate path") or multi-agent orchestration. For a 3-step linear pipeline with a time constraint, chains are faster to build and just as demonstrable. You can mention in your README that LangGraph would be the next step for a production version with self-correction logic.

**Me:** What financial APIs can I use without a paid plan?

**Claude:** Alpha Vantage free tier gives you:
- `OVERVIEW` endpoint — P/E, PEG, profit margin, ROE, D/E, 52-week range, analyst target
- `GLOBAL_QUOTE` — current price, change, volume
- `SYMBOL_SEARCH` — resolve company name → ticker
- Limit: 25 requests/day, 5/minute on free plan

For news: NewsAPI.org free plan gives 100 requests/day. Good enough for dev.

Critically: build a mock data layer so the app works without any API keys. Reviewers shouldn't have to sign up for anything to run your code.

---

## Session 2 — LangChain Prompt Design

**Me:** How should I structure my prompts? I want the final output to be parseable JSON but the intermediate steps to be natural language analysis.

**Claude:** Good instinct to separate them. Here's the pattern:

Prompts 1 and 2 produce **natural language** — this is actually better because LLMs reason more reliably in free text than constrained JSON for multi-step analysis.

Prompt 3 then receives both analyses as context and produces **strict JSON**. The instruction should say: "Respond with a JSON object and nothing else — no markdown, no preamble."

Add a try/catch with a fallback structure in case JSON parsing fails. One extra tip: use double curly braces `{{}}` inside `ChatPromptTemplate.fromTemplate()` to escape literal curly braces in your JSON schema example, since LangChain uses single `{var}` for template variables.

**Me:** What's the best way to handle the case where Alpha Vantage returns a rate limit error or empty data?

**Claude:** Two-layer defense:
1. Try the real API call inside a `try/catch` — if it fails or returns empty/unexpected data, fall through to mock data immediately.
2. Before any API call, check if the key is `'demo'` and skip the network call entirely.

For the rate limiter, a simple in-memory array of timestamps is fine for a demo:
```typescript
const requestQueue: number[] = [];
// Remove entries older than 60s, check length against RPM limit
```
This doesn't survive serverless cold starts but works for single-instance dev/demo.

**Me:** My DECISION_PROMPT needs to produce a JSON object that includes an array of "steps". How do I prompt for that reliably?

**Claude:** Be explicit and give a complete JSON schema in the prompt itself. Show the exact structure with placeholder types. Key things that help GPT-4o-mini produce clean JSON:

1. Say "Respond ONLY with a JSON object — no markdown backticks, no explanation before or after"
2. Show the exact field names and types you expect
3. Give a concrete example for array items (e.g., what one `step` object looks like)
4. Specify the allowed enum values (e.g., `"signal": "bullish|bearish|neutral"`)

For extra robustness, strip any ```json fences before parsing: `text.replace(/\`\`\`json|\`\`\`/g, '').trim()`

---

## Session 3 — Frontend Design

**Me:** What UI/UX approach should I take for this? It's a fintech-style app but I want it to look distinctive, not generic.

**Claude:** The temptation is to go with a white/light Bloomberg-clone with lots of tables. Resist it. Go the opposite direction: dark terminal aesthetic with electric blue signal colors. This fits the "AI agent" metaphor — it feels like you're watching a system think.

Key design decisions:
- **Background**: near-black `#0a0e1a` — not pure black, it has a blue undertone
- **Monospace font for all data** (JetBrains Mono) — signals precision
- **Signal colors**: green for invest/bullish, red for pass/bearish — universal and immediate
- **Confidence ring** instead of a progress bar — more distinctive
- **Reasoning chain as numbered steps** with per-step signal badges and mini confidence bars

The single signature element: the **INVEST / PASS** verdict in 42px monospace with a glowing border matching the signal color. That's what people will remember.

**Me:** How should I show the loading state? The analysis takes ~15-30 seconds.

**Claude:** Don't just show a spinner — show the *pipeline steps* animating through. This does two things:
1. Makes waiting feel shorter (the app is clearly doing work)
2. Educates the user about what the agent is actually doing

Show 5-6 steps (Resolving ticker → Fetching fundamentals → Fetching news → Running fundamental analysis → Scoring sentiment → Synthesizing decision) with a checkmark appearing as each completes. Since you don't have real-time step events from the server (no WebSockets), just time the transitions at ~2.8s intervals — matches the real processing time well enough.

**Me:** How do I handle the reasoning chain UI? I have an array of `step` objects.

**Claude:** Each step should show:
- Step number (monospace, muted — `01`, `02`...)  
- Step name (bold)
- Signal badge (bullish/bearish/neutral with appropriate color)
- Finding text (the LLM's reasoning)
- Mini confidence bar (fills based on the 0-1 confidence value)

Keep it compact — card style with a left indent for the finding text. The step number as a structural label works here because the steps are genuinely sequential, not just a decoration.

---

## Session 4 — Rate Limiting & Error Handling

**Me:** What error states should I handle?

**Claude:** Prioritize these:
1. **LLM API key missing/invalid** → clear error message pointing to .env.local setup
2. **JSON parse failure** on the decision prompt → have a fallback object ready, don't crash the page
3. **Alpha Vantage rate limit** (429 or `"Note"` field in response) → fall through to mock silently
4. **Unknown company** → if symbol search returns nothing, still proceed with the input as-is and let the LLM do its best
5. **Timeout** → set axios timeout to 10s per request; wrap the whole agent in a 55s timeout for Vercel's 60s limit

Show all errors inline (not modal, not toast) — the user is probably debugging and wants to see the full message.

**Me:** Should I add input validation on the company name?

**Claude:** Light validation only: trim whitespace, check non-empty, max length ~100 chars. Don't try to validate whether it's a "real" company name or ticker server-side — the agent handles that gracefully by searching and falling back. Overly strict validation frustrates users who enter things like "Berkshire Hathaway B" or "Meta Platforms Inc".

---

## Session 5 — Deployment & Polish

**Me:** What do I need to do to deploy to Vercel?

**Claude:** Four things:
1. Add `vercel.json` with `"maxDuration": 60` on your analyze route — the default is 10s which is too short for 3 LLM calls
2. Move your `.env.local` values to Vercel's environment variables dashboard (or use `vercel env add`)
3. Make sure `next.config.js` lists LangChain packages in `serverComponentsExternalPackages` — some LangChain internals use Node.js APIs that Next.js's edge runtime doesn't support
4. Test `npm run build` locally first — TypeScript errors that pass in dev sometimes surface only at build time

**Me:** Any TypeScript gotchas with LangChain.js I should watch out for?

**Claude:** A few:
- `ChatPromptTemplate.fromTemplate()` returns a `ChatPromptTemplate<InputValues>` — TypeScript will complain if you don't type your `invoke()` call to match the template variables. Easiest fix: type the input object explicitly.
- `StringOutputParser` loses type info — it returns `string`, which is what you want for the intermediate prompts
- The JSON from your third prompt comes back as `string` — you have to `JSON.parse()` it yourself, there's no built-in structured output parser in `@langchain/core` 0.3.x that handles complex nested types without Zod schemas. Your try/catch fallback handles this.
- Don't forget `--break-system-packages` if you're using pip in the same environment, but that's not relevant here since it's all npm.

---

*End of transcript. Total LLM sessions: 5 | Build time: ~4.5 hrs of active development*
