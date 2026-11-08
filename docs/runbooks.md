# Runbooks

**Status: written, never exercised. No on-call owner exists.** These are for this demo's stack. Flow: [`diagrams/incident-response.mmd`](diagrams/incident-response.mmd).

For every incident: note the time and correlation IDs, contain first, then investigate. If you find a real person's data or possible harm, stop and involve someone qualified. Don't decide alone whether something is a reportable breach.

## An unsafe or wrong reply was reported

1. **Find it.** Sign in as a supervisor and open the call in **Reviews**. Reading is logged.
2. **Classify.** Record a finding. A reply marked "model reply blocked" means the validator worked and the fallback was spoken.
3. **Contain, if repeatable.** Roll back in Vercel, or set `GROQ_API_KEY` to empty so that only fixed scripts are spoken.
4. **Fix.** Add a case to `lib/evaluations/dataset.ts` that fails first, then fix the rule.
5. **Verify.** Run `npm test` and `npm run eval:offline`.

## Personal data appears in logs

1. **Contain.** Vercel logs: restrict access. Identify the deployment and time range.
2. **Find the source.** The logger drops anything off its allowlist, so look for a raw `console` call or a new allowlisted field.
3. **Fix** and add a canary case to `tests/logger.test.ts`.
4. **Delete** the affected logs where the platform allows it.

## A key or secret leaked

1. **Rotate** immediately in the provider's console and in Vercel: Groq, ElevenLabs, Anthropic, Neon, Upstash, `CRON_SECRET`.
2. If `CALL_TOKEN_SECRET` leaked: rotating it ends live calls and **makes stored callback numbers unreadable**, since the key derives from it.
3. **Revoke staff sessions:** `POST /api/staff/users/:id/revoke-sessions` as an admin, for each user.
4. **Check** provider usage and the audit log. Search git history, because the repository is public.

## A provider is down

| Provider | What callers get | Action |
| --- | --- | --- |
| Groq | "I'm having trouble answering". Fixed scripts still work | Wait. Don't add an unreviewed provider |
| ElevenLabs | Device voice, or text only | Wait |
| Anthropic | Groq or rule-based briefs | Wait |
| Neon | Calls continue unlogged; staff pages fail | Wait, then check the turn-write errors in logs |
| Upstash | In-memory limits per instance | Wait |

## Bad knowledge document published

1. **Retire it:** Knowledge page, or `POST /api/knowledge/versions/:id` with `{"action":"retire"}`. It's excluded from retrieval at once.
2. **Find affected calls** by querying `turn_citations` for that version.
3. Upload a corrected version for a second person to approve.

## Spending spike

1. Check provider dashboards, then Vercel logs for `rate_limited` and high request counts.
2. Lower limits in `lib/rate-limit.ts`, or remove the provider key to fall back to fixed scripts.
3. Add `UPSTASH_REDIS_REST_URL`, since in-memory limits are per instance.

## Rolling back

- **Application:** promote the previous deployment in Vercel.
- **Database:** forward-fix only. Migrations must stay compatible with the previous build.
- **Prompt or policy:** revert the commit, and rerun the evaluation.
