# CareLink — AI Scheduling Assistant

A conversational AI web application that automates medical appointment booking. Patients describe their symptoms in plain language, get matched to the right specialist, and confirm an appointment — all through a chat interface.

---

## What it does

CareLink walks a patient through a guided intake conversation:

1. Collects basic info — name, date of birth, phone, email
2. Asks for the reason for visit in plain language
3. Matches the patient to the right specialist based on symptoms
4. Offers the next 3 available appointment slots
5. Confirms the booking and sends a summary

Patients can also filter slots by day or time preference ("Do you have anything Tuesday morning?") or escalate to a voice call at any point.

---

## Specialist coverage

| Specialty     | Example symptoms                              |
| ------------- | --------------------------------------------- |
| Orthopedic    | knee pain, joint issues, ACL, limping         |
| Cardiac       | chest pain, palpitations, shortness of breath |
| Dermatology   | rash, acne, eczema, moles, hives              |
| Ophthalmology | blurry vision, eye pain, cataracts, glaucoma  |

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** — glassmorphism UI with teal-cyan brand colors
- **Stateless API** — conversation state lives on the client; no database required
- Server-side chat engine at `app/api/chat/route.ts`

---

## Project structure

```text
├── app/
│   ├── api/chat/route.ts     # POST endpoint — receives message + state, returns reply
│   ├── layout.tsx            # Root layout, metadata, Inter font
│   ├── page.tsx              # Home page with decorative blobs
│   └── globals.css           # Tailwind import, glassmorphism, animations
├── components/
│   ├── ChatWindow.tsx        # Main chat container — state management, API calls
│   ├── ChatInput.tsx         # Text input + Send button
│   ├── MessageBubble.tsx     # Individual message with avatar and markdown bold
│   ├── TypingIndicator.tsx   # Animated three-dot bounce while waiting
│   └── VoiceEscalation.tsx  # "Continue via Phone" handoff button
└── lib/
    ├── chat-engine.ts        # State machine with 11 conversation steps
    ├── doctors.ts            # Specialist registry + keyword-based matching
    ├── scheduling.ts         # Slot generation (45 days forward), filtering, booking
    └── types.ts              # TypeScript interfaces for all data structures
```

---

## Conversation flow

```text
greeting
  └── collect_firstName
        └── collect_lastName
              └── collect_dob
                    └── collect_phone
                          └── collect_email
                                └── collect_reason
                                      ├── offer_slots  ──→  confirm_booking  ──→  booked
                                      └── no_match (no specialist matched symptoms)
```

Medical advice requests (diagnose, treatment, prescription, etc.) are intercepted at any step and redirected to booking.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run lint    # ESLint
```

---

## Appointment slots

Slots are generated in-memory for 45 days forward. Each specialist has fixed recurring times:

| Day       | Time     |
| --------- | -------- |
| Tuesday   | 2:00 PM  |
| Thursday  | 10:00 AM |
| Friday    | 9:00 AM  |

State resets on server restart. To add persistence, replace the in-memory store in [lib/scheduling.ts](lib/scheduling.ts) with a database.

---

## Extending the assistant

**Add a specialist** — edit [lib/doctors.ts](lib/doctors.ts): add a `Doctor` entry with a name, specialty string, and a keyword array.

**Add more slots** — edit the `SLOT_SCHEDULE` in [lib/scheduling.ts](lib/scheduling.ts).

**Change conversation steps** — edit the `processMessage` switch in [lib/chat-engine.ts](lib/chat-engine.ts) and update the `ConversationStep` union type in [lib/types.ts](lib/types.ts).

**Connect a real AI model** — the `openai` package is already installed. Wire it into `processMessage` or replace the rule-based logic entirely.
