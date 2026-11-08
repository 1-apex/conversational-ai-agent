# Conversational AI Agent (Independent Demo)

A browser-based AI voice agent that simulates a customer-support line about Inogen portable oxygen concentrators.

> **This is an independent demo. It is not affiliated with, authorized by or endorsed by Inogen.** It is not a medical service or an emergency service, and it must not be used with real patients or real health information. Its product information is largely unverified and may be wrong. For real help, contact Inogen or your care team. In an emergency, call 911.

## What it does

- Listens through the browser's speech recognition and replies out loud.
- Routes the conversation between five AI agents: Main, Sales, Product, General and B2B.
- Handles interruptions and silence.
- Runs every reply through a safety engine and a response validator, with fixed scripts for emergencies and medical questions.
- Writes a structured call brief when the call ends.
- With a database: staff login, a practice support queue, document approval, quality reviews, evaluations, and an audit log.

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4.

| Purpose | Service | Required? |
| --- | --- | --- |
| Speech recognition | Browser Web Speech API (Chrome or Edge) | Yes |
| Agent replies | Groq, Llama 3.3 70B | Yes |
| Voice | ElevenLabs, or the browser voice as a fallback | No |
| Call briefs | Claude, then Groq, then regex rules | No |
| Call logging | Neon Postgres | No |
| Shared rate limits | Upstash Redis | No |

## Getting started

```bash
npm install
cp .env.example .env
npm run dev
```

Set at least `GROQ_API_KEY` in `.env`, then open http://localhost:3000 in Chrome or Edge and allow the microphone. For staff pages and full setup with no accounts, follow [the testing guide](docs/testing-guide.md).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Automated tests; no keys or database needed |
| `npm run test:e2e` | Browser journeys, after `npm run build` |
| `npm run eval:offline` | 235-case benchmark with scripted model replies |
| `npm run eval:live` | The same with the real model. Needs `GROQ_API_KEY` and costs API usage |
| `npm run db:migrate`, `npm run db:seed` | Create tables and test accounts |

## Known limitations

- The safety engine is phrase matching plus an LLM classifier. It will miss things, and no clinician has reviewed it.
- Every safety result so far comes from scripted model replies. **The live evaluation has never been run.**
- Product information in `lib/inogen-knowledge.ts` is largely unverified.
- Staff login is a small custom implementation with no MFA.
- Speech goes to outside services, so don't use real personal or health information.

[`docs/implementation-status.md`](docs/implementation-status.md) has the full list.

## Documentation

[`docs/`](docs/README.md) has the audit, architecture, decision records, diagrams, runbooks and roadmap.
