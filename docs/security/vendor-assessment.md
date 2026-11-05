# Vendor and Provider Assessment

**Checked 2026-11-04 from public pages. No contract, account or sales conversation was reviewed.** Terms change, and public statements aren't commitments. **No provider or product here should be considered HIPAA compliant or approved for PHI on this basis.** Re-verify before signing.

## Summary

| Provider | Role | Receives today | Sensitive? | BAA path found | Status for PHI |
| --- | --- | --- | --- | --- | --- |
| Browser speech service | STT | Caller audio | Yes | None found | **Do not use** |
| Groq | Agent LLM, brief fallback | Full transcript on every turn | Yes | Published addendum | Not approved, contract needed |
| Anthropic | Brief LLM | Full transcript at call end | Yes | Yes, eligible API features | Not approved, contract needed |
| ElevenLabs | TTS | Reply text | Possibly | Enterprise; TTS scope unclear | Not approved, scope unclear |
| Vercel (assumed) | Hosting | All requests in transit, logs | Yes | Pro add-on | Not approved, contract needed |
| Neon | Database | Transcripts, briefs | Yes | Scale plan | Not approved, enablement needed |
| Upstash | Rate limiting | IP addresses in keys | Personal data | Enterprise plan | Keep PHI out |
| Langfuse (not adopted) | Tracing | Nothing yet | Redacted only | HIPAA cloud region | Details conflict |

## Details

### Browser speech recognition

- **Data:** caller audio, before any application control can run.
- **Found:** MDN says that by default [audio is sent to a web service](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API), and that on-device recognition is possible through `processLocally` with a language pack.
- **Unknown:** the operator of the service in each browser, its retention, and its terms. No contract exists between the operator of this app and that service.
- **Position:** synthetic mode only.

### Groq

- **Data:** system prompt, knowledge, transcript.
- **Found:** a [Customer Business Associate Addendum](https://console.groq.com/docs/legal/customer-business-associate-addendum) is published. [Groq's data page](https://console.groq.com/docs/your-data) says inference data isn't retained by default, apart from temporary logging for reliability and abuse monitoring of up to 30 days. Zero Data Retention can be enabled in Data Controls. Customer data is stored in US-based Google Cloud buckets.
- **Unknown:** the page doesn't state a training policy, so check the service terms. Third-party sources conflict on BAA availability, so confirm that the addendum applies to the account and the model.
- **Needed:** executed addendum, ZDR on, model hosting terms reviewed.

### Anthropic

- **Data:** transcripts for briefs, and possibly evaluation and classification later.
- **Found:** Anthropic's [BAA article](https://privacy.claude.com/en/articles/8114513-business-associate-agreements-baa-for-commercial-customers) lists eligible services. The Messages API is covered for listed features only, and items such as the Batch API and several beta tools are excluded. A separate page lists [covered models](https://support.claude.com/en/articles/15455031-covered-models-under-a-business-associate-agreement-baa). HIPAA-ready organizations have non-eligible features blocked.
- **Needed:** executed BAA; confirm `claude-sonnet-4-6` and the features used are covered.

### ElevenLabs

- **Data:** reply text, which may repeat what a caller said.
- **Found:** the [HIPAA page](https://elevenlabs.io/docs/eleven-agents/legal/hipaa) limits BAAs to Enterprise and describes Zero Retention Mode for ElevenLabs Agents. It doesn't mention the standalone TTS API that this app uses.
- **Needed:** written confirmation of TTS coverage from ElevenLabs. Until then, assume it's not covered.
- **Note:** the free tier and quota meter suggest the current account isn't Enterprise. Confirm.

### Vercel

- **Data:** request traffic, function logs and possibly analytics. Deployment here is unverified.
- **Found:** [Vercel's changelog (September 2025)](https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams) says BAAs are a paid self-serve add-on for Pro teams, redlines need Enterprise, and a BAA doesn't make a customer compliant by itself.
- **Needed:** BAA, log content review, and confirmation that any Vercel products used are in scope.

### Neon

- **Data:** the most sensitive data at rest.
- **Found:** [Neon's HIPAA docs](https://neon.com/docs/security/hipaa) describe a self-serve BAA with Databricks on the Scale plan. The Data API isn't covered. Enablement can't be reversed. PHI must stay out of metadata, table names, logs and support tickets. A 15% surcharge is planned.
- **Needed:** plan upgrade, a separate project per environment, pgvector compatibility check.
- **Caution:** enabling HIPAA is irreversible, so it needs a deliberate decision from you.

### Upstash

- **Data:** rate-limit keys that contain IP addresses in the current implementation.
- **Found:** [Upstash's healthcare guide](https://upstash.com/docs/redis/help/managing-healthcare-data) ties BAAs to the Enterprise plan and says PHI belongs only in values, not keys.
- **Position:** keep it PHI-free, and hash keys. No BAA should be needed if that holds, subject to review.

### Langfuse (candidate)

- **Found:** [Langfuse](https://langfuse.com/baa) documents a HIPAA-ready cloud region for Pro or higher plans, while self-hosting leaves responsibility with the operator. Public pages disagree about BAA mechanics.
- **Position:** optional. Send redacted data only. Confirm details if adopted.

## Questions for every vendor

1. Is this exact product, model and endpoint covered by the signed agreement?
2. What's retained, for how long, and can it be set to zero? Is that contractual?
3. Is customer data used for training?
4. Which subprocessors and regions are involved?
5. What is the breach notification commitment?
6. Which logging, abuse monitoring and support access can expose content?

## Fallback rule

A provider may serve as a fallback only if it would be approved as a primary for the same data class.
