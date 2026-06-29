# Deaddrop Payments — Compliant Money at a Drop

How a finder can collect a real money bounty left at a deaddrop, legally
and traceably. This is the design and the prerequisites. No money code
ships until the prerequisites below are done and the flag is flipped.

## The rule that shapes everything

Moving other people's money is regulated. The platform does not become a
money transmitter only if a **licensed party holds and moves the funds**
and **both sides are identity-verified with a full record**. So:

- **Stripe is the licensed money mover.** We use **Stripe Connect**.
  Stripe holds funds and runs KYC. We never touch a bank rail directly.
- **No anonymity.** Funder and finder are both KYC-verified Stripe
  Connect accounts. Every cent is logged: who funded, who collected,
  amount, drop, GPS, timestamp.
- **Full audit trail, forever.** The opposite of "paper trail ends at
  the drop." That phrasing is off the table.
- **Lawful access, not a backdoor.** We respond to specific warrants and
  subpoenas for specific accounts under a written legal-process policy.
  There is no master key.

## Architecture

```
Funder (KYC'd Connect acct)                Finder (KYC'd Connect acct)
        |                                            |
        | 1. fund bounty on a drop                   |
        v                                            |
   Stripe PaymentIntent  --> funds held on platform  |
        |                                            |
        |        2. finder reaches drop, GPS-gated   |
        |           claim_hunt_find() returns ok     |
        |                                            v
        +--> 3. Stripe Transfer to finder's connected account
                 (optional platform fee), recorded in payouts
```

- **Fund:** funder creates a bounty on a drop. A Stripe PaymentIntent
  charges them; funds sit on the platform balance, earmarked.
- **Gate:** release is allowed only when the existing server-side find
  gate passes (`claim_hunt_find` ok, inside radius + 25m). Same gate,
  now also unlocking money.
- **Release:** Stripe Transfer/payout to the finder's connected account.
  Finder decides how to cash out (Stripe handles the bank rail).
- **Refund:** if the drop is never found, expires, or is disputed, the
  funder is refunded. Disputes follow Stripe's process.

## Data model (additive migration, built behind a disabled flag)

- `drop_bounties` — `cache_id`, `funder_id`, `amount_cents`, `currency`,
  `stripe_payment_intent_id`, `status` (held | released | refunded |
  expired), `platform_fee_cents`, `created_at`, `expires_at`.
- `payouts` — `bounty_id`, `finder_id`, `stripe_transfer_id`,
  `amount_cents`, `released_at`, `find_id` (links to the GPS find row).
- `connect_accounts` — `profile_id`, `stripe_account_id`,
  `charges_enabled`, `payouts_enabled`, `kyc_status`.

Everything is identity-linked. Nothing is anonymous.

## Limits and fraud controls (quiet, built in)

- Per-bounty and per-day caps until an account ages in.
- Hold/clearing window before release.
- One funder cannot fund a drop they then "find" themselves (self-deal
  block via account + device + GPS heuristics).
- Velocity and pattern flags reviewed before large releases.

## Prerequisites — Cameron's, before any money code

1. **Form the entity** (HereToo LLC or similar). Stripe Connect platform
   onboarding wants a real business.
2. **Enable Stripe Connect** on the Stripe account; complete the
   platform profile.
3. **Publish ToS + Privacy Policy** on heretoo.social. Stripe and
   consumer money flows both require them.
4. **Consult a payments/fintech attorney** on the Connect platform
   classification and any state money-transmitter exposure. Stripe
   Connect usually keeps the platform out of MSB territory, but the
   bounty/escrow shape should be confirmed by counsel, not by me.
5. **Decide the fee model** (platform fee per bounty, or free for now).

## Phasing

- **P0** Prerequisites above. Blocking.
- **P1** Schema migration + Connect onboarding flow (verify identity).
- **P2** Fund a bounty (PaymentIntent, held).
- **P3** GPS-gated release to the finder (Transfer), recorded.
- **P4** Refunds, expiry, disputes.
- **P5** Limits, fraud heuristics, reporting.

No `EXPO_PUBLIC`/server payment code runs until P0 is done. The feature
ships behind a disabled flag so nothing moves money by accident.

## Out of scope, on purpose

- Anonymous or untraceable transfers. Never.
- A standing law-enforcement backdoor. We honor specific lawful process.
- Crypto rails (a money-transmitter and tax surface of their own). Maybe
  later, with counsel.
