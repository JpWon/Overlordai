# Legal decisions — status

Last updated 2026-10-15, in the commit that rewrote the legal pages for the Paddle review
(`docs/WEBSITE_PADDLE_READY_HANDOFF.md` in the psyche repo). Not served, not in the sitemap.

## In force now

| Decision | Value | Where |
|---|---|---|
| Seller / licensor | **Primus Enterprises LLC, dba Overlord AI** (Florida) | every page, footer |
| Business address | **411 W 1st St, Unit #5073, Sanford, FL 32771** (never a home address) | footer, Contact, every legal page |
| Payments | **"our payment provider"**, reseller and merchant of record, **not named** until checkout is live (Eros 2026-10-16). To name Paddle again, restore the wording from commit 1ff6ccf / cddd5f2. | Terms §5, Plans, Refunds, Privacy §7, Contact |
| Founder Access | every plan **$0 until 15 November 2026** (`assets/founder-config.js`) | Plans, Terms §4, Refunds §3, EULA §4 |
| Refund window | **3 days on a first payment**, renewals excluded (Eros, kept 2026-10-16); EU/UK statutory 14-day withdrawal via Paddle stands | Refunds, Terms §6, Plans |
| Minimum age | 13 | Terms §3, EULA §1, Privacy §15 |
| Price / material-change notice | 30 days | Terms §5, §15 |
| Governing law | Florida; state or federal courts in Florida | Terms §14, EULA §14 |
| Support | support@overlordai.co, reply within two business days | Contact, EULA §9, support.html |
| Privacy contact | privacy@overlordai.co | Privacy |

## For Eros to confirm

- **Attorney review** of all five pages (Terms, Privacy, EULA, Refunds, Contact).
- **Retention periods** in Privacy §10 were proposed in this pass: account data deleted within 30 days
  of a deletion request, service logs about 30 days (the Cloud Run default), Founder Access / waitlist /
  support email at most two years after last contact.
- **Cookie consent.** The Google Ads tag and Rewardful set cookies with no consent banner. EU/UK law
  usually wants consent first; California may treat the Ads tag as "sharing". Privacy §8 and §11 say so
  plainly; a banner (or dropping the tag for EU visitors) is the fix.
- **Trademark.** No ™/® on "Overlord AI" until counsel has an opinion on EA's OVERLORD mark.

## How the pages are built

`legal/<name>.content.html` + `legal/_skeleton.html` → `<name>.html` via `python3 legal/build_legal.py`
(names: eula, privacy, terms, refunds, contact). Never edit a generated page.
