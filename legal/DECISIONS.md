# Legal decisions — status, and what is left

Your answers are in the live documents. Seven of the eight facts are decided and applied, including
your correction — the refund window is **seven days**, not fourteen. What remains is one postal
address and one product behaviour, plus one offer to build.

## Applied 29 September 2026

| Decision | Value now in the documents | Where |
|---|---|---|
| Minimum age | **13** | EULA §1 · Privacy §14 · Terms §2 |
| Effective date | **29 September 2026** | the header of all three |
| Privacy contact | **privacy@overlordai.co** (a mailto link) | Privacy §9, §14, §17 |
| Refund window | **seven days on a first paid period**, renewals excluded | Terms §8 |
| Where the law gives longer | the longer statutory window governs | Terms §8 |
| Renewal notice | **30 days** before a price or material change | Terms §5, §16 |
| Tax | prices **exclusive of tax**, calculated at checkout, shown on the receipt | Terms §5 |
| Entity and law | **De Primus Enterprises**, **Florida law** | EULA §1, §15 · Privacy §12 · Terms §2, §15 |

Two knock-on edits came with those, because the old text contradicted the new answers: the EULA no
longer says "no refund window is published", and the Privacy Policy no longer calls the age floor a
mismatch to resolve — it now says plainly that an account at 13 is not permission to play an 18-rated
title.

I read the effective-date suggestion as "today", since the documents are live and the entity and the
governing law are settled. If you would rather it read the day Stripe checkout opens, that is one
edit.

## What I still need

**1. A postal address for formal notices.** `[NOTICES ADDRESS]` is still in EULA §16, Privacy §17 and
Terms §17, because an address is a fact I cannot derive and inventing one is worse than leaving the
gap visible. Any address that can accept service works; a registered-agent or mailbox address is
normal at this stage. Send the exact text you want printed and all three get it in one pass.
`info@overlordai.co` currently sits beside it as the interim route — say the word if that should
become the permanent wording instead.

**2. The frame retention limit.** Privacy §10 states today's truth: a captured frame lives as long as
the process that captured it, and the limit is written down as a requirement that is not built. For
it to become a number, pick the behaviour — I can build whichever you choose:

| Option | What the page would then say | Work |
|---|---|---|
| **A (recommended)** — the frame is dropped the moment the answer is rendered | "Each frame is discarded as soon as your answer is produced." | small: one lifetime change in the frame pipeline |
| **B** — frames live in RAM for the session, wiped when the app closes | that, as a session-scoped buffer with nothing on disk | smallest, weakest claim |
| **C** — a bounded buffer, N frames or N seconds | "Frames older than N seconds are overwritten and never written to disk." | small, and it lets you print a number |

Until one is chosen the token stays, as agreed — nothing filled in with a guess.

**3. The three things Privacy §15 says are not built.** The visible *"what I just sent"* panel, the
single **kill switch**, and the **session-record opt-in toggle**. Disclosing them is honest but it
reads as a gap on the page a cautious buyer opens first. Tell me which you want and I will scope them
in the app — the panel and the kill switch are the transparency story and I would do those two first.

**4. One small thing.** Each document's header still reads **"Draft for review"** beside the effective
date. That is accurate while a token is visible and it comes off in the same pass that closes the last
two items. Say so if you want it gone sooner.

## Two operational items, not decisions

- **Create the mailboxes.** `overlordai.co` is on Proton Mail (MX `email.proton.me` and
  `email.protonmail.ch`, with a Proton SPF record), so **privacy@** and **info@** are addresses you add
  in Proton — a couple of minutes. The Privacy Policy now names `privacy@overlordai.co` as where rights
  requests go, so that inbox should exist before anyone relies on it. Worth mailing yourself a test to
  both.
- **Billing is still not live**, which the Terms say plainly. The seven-day window and the tax wording
  only bite once Stripe checkout exists; nothing on the site can take a payment today.

## Where the words live

```
legal/_skeleton.html        site chrome + the .lg-* prose stylesheet (edit chrome here)
legal/eula.content.html     the words of the EULA            ─┐
legal/privacy.content.html  the words of the Privacy Policy   ├─ edit these, then rebuild
legal/terms.content.html    the words of the Terms of Service ─┘
legal/build_legal.py        splices skeleton + fragment → eula.html / privacy.html / terms.html
```

Never edit `eula.html`, `privacy.html` or `terms.html` directly — the next build overwrites them.
Each fragment opens with a `DECISIONS BEFORE PUBLICATION` comment that now also records the decisions
already applied, so whoever opens the file next can see what was settled, when, and on whose say-so.

Status of this file: a working note in the repo, not part of the published site (not in
`sitemap.xml`, and `robots.txt` keeps `/legal/` out of search results — though it is still reachable
if someone types the exact path). Last updated 2026-09-29, in the commit that carries it.
