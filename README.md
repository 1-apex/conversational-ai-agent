# Conversational AI Agent Platform

A Next.js application with two integrated AI products: **CareLink**, a medical appointment booking assistant, and **CallStudio**, a real-time call intelligence system with multi-agent routing.

---

## Products

### CareLink — AI Scheduling Assistant

Guides patients through a guided intake conversation, matches them to the right specialist based on symptoms, and books an appointment — entirely through chat or voice.

**Intake flow (11 steps):**

```text
greeting → firstName → lastName → DOB → phone → email → reason
  └── specialist match → offer slots → confirm → booked
```

Medical advice requests (diagnose, prescribe, treat) are intercepted at any step and redirected to booking.

**Specialist coverage:**

| Specialty     | Example symptoms                              |
| ------------- | --------------------------------------------- |
| Orthopedic    | knee pain, joint issues, ACL, limping         |
| Cardiac       | chest pain, palpitations, shortness of breath |
| Dermatology   | rash, acne, eczema, moles, hives              |
| Ophthalmology | blurry vision, eye pain, cataracts, glaucoma  |

**Appointment slots** — generated 45 days forward, recurring per specialist:

| Day       | Time     |
| --------- | -------- |
| Tuesday   | 2:00 PM  |
| Thursday  | 10:00 AM |
| Friday    | 9:00 AM  |

Patients can filter by preference ("anything Tuesday morning?") or escalate to a voice call at any time.

---

### CallStudio — Call Intelligence

A real-time call session interface with five specialized AI agents, live transcription, entity extraction, and auto-generated call briefs.

**Agents:**

| Agent | Role |
| ----- | ---- |
| Orchestrator | First contact, intake, and routing |
| Sales | Product matching, pricing, insurance handling |
| Product | Technical specs, comparisons, accessories |
| General | Warranty, shipping, prescriptions, company info |
| B2B | Business accounts, DME suppliers, wholesale |

**Features:**

- Real-time speech recognition via Web Speech API
- Intelligent agent handoff — LLM decides when to route to a specialist agent
- Live entity extraction: names, companies, products, emails, phones, dates, prices
- AI-powered call briefs with action items (Groq or Claude, with rule-based fallback)
- Turn-by-turn transcript with speaker labels and timestamps
- Elapsed call timer
- Voice TTS responses (ElevenLabs neural voices or Web Speech fallback)
- Hands-free mode — mic auto-opens after assistant finishes speaking
- Mute to stop playback mid-sentence

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, glassmorphism UI |
| LLM | Groq (Llama 3.3 70B) — primary |
| LLM (alt) | Anthropic Claude Sonnet 4.6 — call brief extraction |
| TTS | ElevenLabs neural voices (optional) + Web Speech fallback |
| Speech input | Web Speech API (browser-native) |
| State | Client-side (no database required) |

---

## Project Structure

```text
app/
  api/
    chat/route.ts         # CareLink intake — stateless message handler
    agent/route.ts        # CallStudio multi-agent loop (Groq-powered)
    extract/route.ts      # Call brief extraction (Claude → Groq → rule-based)
    tts/route.ts          # ElevenLabs TTS proxy
  page.tsx                # Home page (renders CallStudio)
  layout.tsx
  globals.css

components/
  CallStudio.tsx          # Main call interface — speech recognition, agent loop, TTS
  AgentTranscript.tsx     # Scrollable turn-by-turn transcript
  CallBrief.tsx           # Call brief display
  AgentBadge.tsx          # Agent avatar and name
  ChatWindow.tsx          # CareLink chat UI
  ChatInput.tsx           # Text + voice input
  MessageBubble.tsx       # Message display with markdown bold support
  TypingIndicator.tsx     # Animated loading dots
  VoiceEscalation.tsx     # "Continue via Phone" handoff button
  CubePulse.tsx           # Animated thinking indicator

lib/
  agent-prompts.ts        # System prompts for all 5 agents
  inogen-knowledge.ts     # Product/company knowledge base
  entity-extractor.ts     # Real-time entity extraction and merging
  rule-brief.ts           # Fallback brief generation (no API key required)
  groq-client.ts          # Groq API wrapper
  claude-client.ts        # Anthropic SDK wrapper
  chat-engine.ts          # CareLink intake state machine
  doctors.ts              # Specialist registry + keyword matching
  scheduling.ts           # Slot generation, filtering, booking
  validation.ts           # Email, phone, DOB validators
  types.ts                # Shared TypeScript interfaces
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your keys:

```bash
# Required for CallStudio agent responses
GROQ_API_KEY=your_groq_api_key

# Optional — neural TTS (falls back to Web Speech if omitted)
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Optional — alternative call brief extraction
ANTHROPIC_API_KEY=your_anthropic_api_key
```

All keys are optional — the app runs without any, using Web Speech for TTS and rule-based logic for call briefs.

### 3. Run

```bash
npm run dev       # dev server → http://localhost:3000
npm run build     # production build
npm start         # production server
npm run lint      # ESLint
```

**Browser requirements:** Chrome, Edge, or Safari with microphone permission for CallStudio voice features. HTTPS recommended in production for full Web Speech API support.

---

## API Extraction Priority

Call briefs fall back gracefully when keys are missing:

```text
Claude (ANTHROPIC_API_KEY) → Groq (GROQ_API_KEY) → Rule-based regex
```

---

## Extending

**Add a specialist** — edit [lib/doctors.ts](lib/doctors.ts): add a `Doctor` entry with name, specialty, and keyword array.

**Add appointment slots** — edit `SLOT_SCHEDULE` in [lib/scheduling.ts](lib/scheduling.ts).

**Add a call agent** — add a system prompt in [lib/agent-prompts.ts](lib/agent-prompts.ts), register it in the agent router in [app/api/agent/route.ts](app/api/agent/route.ts).

**Change conversation steps** — edit the `processMessage` switch in [lib/chat-engine.ts](lib/chat-engine.ts) and update the `ConversationStep` union in [lib/types.ts](lib/types.ts).

**Swap the LLM** — update [lib/groq-client.ts](lib/groq-client.ts) or wire in a different provider in the API routes.
