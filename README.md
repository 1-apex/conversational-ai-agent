# Conversational AI Agent (Independent Demo)

A browser-based AI voice agent that simulates a customer-support line about Inogen portable oxygen concentrators.

> **This is an independent demo. It is not affiliated with, authorized by or endorsed by Inogen.** It is not a medical service or an emergency service, and it must not be used with real patients or real health information. Its product information is largely unverified and may be wrong. For real help, contact Inogen or your care team. In an emergency, call 911.

## What it does

- Listens through the browser's speech recognition and replies out loud.
- Routes the conversation between five AI agents: Main, Sales, Product, General and B2B.
- Handles interruptions and silence.
- Writes a call brief when the call ends and, if a database is configured, logs it for an analytics dashboard at `/dashboard`.

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

Set at least `GROQ_API_KEY` in `.env`, then open http://localhost:3000 in Chrome or Edge and allow the microphone.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |

## Known limitations

This project is being hardened in phases, and the following are still true:

- `/dashboard`, `/api/analytics` and `/api/calls` have **no authentication**. Don't deploy it publicly with logging enabled.
- Replies aren't validated before they are spoken.
- Emergency handling is a basic phrase check. It will miss things.
- There are no automated tests yet.
- Speech goes to outside services, so don't use real personal or health information.

## Documentation

[`docs/`](docs/README.md) has the audit, target architecture, decision records, diagrams and roadmap. Most of it describes a proposed design, not current behaviour, and each document says which.
