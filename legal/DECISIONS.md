# Legal decisions before publication

The three documents are live (`www.overlordai.co/eula.html`, `/privacy.html`, `/terms.html`) and
each says **Draft for review**, because eight facts in them are genuinely undecided. Nothing was
invented to fill the gap: each one appears on the page as an uppercase `[TOKEN]` so a reader can
see exactly what is not yet settled.

**To answer them, send the answers in one message — any order, any wording.** Filling them in is
one pass: edit `legal/<doc>.content.html`, run `python3 legal/build_legal.py`, verify, push.
Nothing else needs to change.

Answers already given, and already in the documents:

| Fact | Value | Note |
|---|---|---|
| Contracting entity | **De Primus Enterprises** | you typed `Enterpises`; the corrected spelling is in all three |
| Governing law | **the State of Florida, United States** | Terms §15, EULA §15 |
| State of registration | Florida — *assumed* | taken from the governing law, not stated by you: confirm |

## The eight open decisions

| # | Token | Where it appears | What it decides | Suggested answer |
|---|---|---|---|---|
| 1 | `[MINIMUM AGE]` | EULA §1 · Privacy §14 · Terms §2 | the age at which someone can accept the licence, hold an account and buy a plan in their own name. Below it, a parent or guardian holds the account. | **13**, and say the guides are for 18-rated games so the account age is not the play age. Some EU markets expect 16 — raise it if the EU is a target. |
| 2 | `[NOTICES ADDRESS]` | EULA §16 · Privacy §17 · Terms §17 | a postal address we can be served at, for formal notices. Overwolf's minimum EULA terms expect a name, an address and an email. | a real address that accepts service (a registered-agent or mailbox address is normal). `info@overlordai.co` is an email, not an address. |
| 3 | `[PRIVACY CONTACT ADDRESS]` | Privacy §9, §14, §17 | the role address for data-rights requests. | **privacy@overlordai.co**, real and monitored — a rights request sent to a channel nobody reads is a problem in itself. |
| 4 | `[EFFECTIVE DATE]` | all three (header) | the date each document takes effect. Today they are dated "draft for review". | the day Stripe checkout opens, or today if you want the drafts treated as in force. |
| 5 | `[RETENTION PERIOD]` | Privacy §10 | how long a captured frame survives. **Today: as long as the process that captured it** — the limit is written down as a requirement and is not built, and the policy says so instead of promising a number. | decide the product behaviour first (delete after N seconds), then state N. Nothing to publish before that exists. |
| 6 | `[REFUND POLICY]` + `[DECISION]` | Terms §8 | the voluntary refund window. Mandatory consumer rights exist whatever we write, including a statutory right to withdraw where it applies. | a **14-day window on a first subscription**, no refunds on renewals, and the statutory rights named beside it. |
| 7 | `[RENEWAL NOTICE PERIOD]` | Terms §5, §16 | the warning given before a price change or a material change to a plan or to these Terms. | **30 days**, the common floor (37signals states 30 days to existing customers). |
| 8 | `[TAX HANDLING]` | Terms §5 | whether the prices shown include sales tax or VAT, who collects it, and what the receipt shows. | prices **exclusive** of tax, tax added at checkout by Stripe Tax; US state sales tax where nexus applies. |

## Facts the documents lean on that are not built yet

Stated in the documents as gaps rather than promises, so a reader is not misled. Solve the product
before removing the caveat:

- **Frame retention limit** — Privacy §10 says the limit is a requirement, not a feature.
- **"What I just sent" panel and the kill switch** — Privacy §15 describes them as not yet visible.
- **OS keyring storage for the model key** — Privacy §6 says the requirement is unfinished.
- **Billing** — Terms §4 states no payment can be taken until checkout exists.
- **Windows** — EULA §1, §7 and the Terms §10 put it in beta, unshipped, with no date.
- **Interim contact** — the Terms call `info@overlordai.co` interim and not a promise to keep.

## Where the words live

```
legal/_skeleton.html        site chrome + the .lg-* prose stylesheet (edit chrome here)
legal/eula.content.html     the words of the EULA        ─┐
legal/privacy.content.html  the words of the Privacy Policy ├─ edit these, then rebuild
legal/terms.content.html    the words of the Terms of Service ─┘
legal/build_legal.py        splices skeleton + fragment → eula.html / privacy.html / terms.html
```

Never edit `eula.html`, `privacy.html` or `terms.html` directly — the next build overwrites them.
Each fragment opens with a `DECISIONS BEFORE PUBLICATION` comment listing its own open tokens; keep
that comment in step with the body when an answer lands.

Status of this file: a working note in the repo, not part of the published site (not in
`sitemap.xml`, and `robots.txt` keeps `/legal/` out of search results — though the file is still
reachable if someone types the exact path). Last updated 2026-09-29, in the commit that added it.
