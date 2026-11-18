# Proxima Ship Service — Port Call Platform (demo)

Static, fully client-side demo of an AI-assisted port-call platform. **All data is fictional sample data**; all amounts are illustrative USD, not official port or Suez Canal Authority tariffs. **No API keys, no server, no database.**

## Run

```bash
npm install
npm run dev        # http://localhost:5173
# or a production build:
npm run build      # outputs static files to dist/
npm run preview    # serves dist/ on http://localhost:4173
```

`dist/` can be opened from any static host or sub-folder (relative paths, hash routing).

## Reset the demo

- Sidebar → **Reset demo** (or Settings → **Reset demo data**), then confirm.
- Restores every sample record and scenario state in under a second. Demo state lives only in this browser's `localStorage`; a second tab (e.g. the client view) stays in sync.

## 10-minute run of show (MV Nile Trader)

The Overview page lists these steps with live ✓ progress; each step is clickable.

| Time | Do | Say |
|---|---|---|
| 0:00 | **Port Call Board** — search/filter, open a call | "This is sample data. Every desk works from this one live picture." |
| 1:00 | **Email Inbox → Nomination** → *Extract port call details* → review (source line under each field) → *Confirm & create port call* | "No retyping. The email becomes a port call." |
| 2:30 | Nile Trader → **PDA** tab → *Generate PDA draft* → *Edit* Sundries (e.g. rate 1050, note "Courier for crew documents") → *Approval: switch to D/A Supervisor* → *Approve PDA* | "AI drafts from your tariffs and past calls. Your D/A team approves." |
| 4:30 | **Inbox → Crew change** → *Extract tasks* → *Create 2 tasks*; same for **Provisions**; show Tasks tab, mark one done | "Every request is tracked, with an owner and a deadline." |
| 5:30 | Nile Trader → **Change berth time** → *Berthing +18 h (sample change event)* → *Apply change* | "Ops sees the transit risk and extra cost before the owner calls." |
| 7:00 | On the critical warning: *Request rebooking to 25 Nov 03:00* → *Draft owner update* → edit → *Approve & send (simulated)* | "One click to an accurate update." |
| 8:00 | Header → *Owner view* (or Client Portal) — switch owner in the top bar to show isolation | "The transparency you already promise owners, live." |
| 9:00 | **PDA vs FDA** → *Load final invoices (sample)* → table/chart → *Mark reconciliation reviewed* | "Every difference explained, so fewer disputes." |
| 10:00 | Stop | "Which of these would help your desks most?" |

Expected figures (if Sundries is edited to $1,050): PDA $168,337.25 · delay impact +$6,181.20 · revised estimate $174,518.45 · FDA $176,804.95 · one unexplained line (+$36.50).

## How the "AI" works (honest version)

Every AI-labelled step is a **deterministic simulation** (`src/services/ai/simulated.ts`) behind the `AIService` interface (`src/services/ai/types.ts`):

- Nomination / task extraction — pattern matching on the four predefined emails; each field shows the email line it came from.
- PDA drafting — tariff arithmetic (`src/services/pdaEngine.ts`) using `src/lib/tariffs.ts` and past calls.
- Early warnings — fixed rules (`src/services/scheduleRules.ts`): convoy cut-off check and schedule-driven costs.
- Client update — template filled from current call data.

A model-backed implementation can replace `createSimulatedAI()` in `src/services/ai/index.ts` without UI changes.

## Controls built in

- Operator reviews every extraction before anything is saved.
- Only the D/A desk can approve a PDA; approved PDAs are locked; "send" is a separate, simulated step.
- Owner updates are sent only after explicit approval (simulated — no email leaves the app).
- The client portal reads only `getOwnerPortal(state, ownerId)` (`src/services/clientPortal.ts`): one owner's calls, sent updates and approved figures only.
- Every change is written to the Activity Log with user, time and field-level changes.

## Tests

```bash
npm test           # Node built-in test runner — calculations, rules, approvals, isolation, reset
npm run typecheck
npm run lint
```
