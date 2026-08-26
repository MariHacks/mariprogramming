# MariTools visual arena — Round 2 synthesis (from scratch)

**Why:** Round 1 produced four interchangeable mist-sidebar + form worksheets. User rejected sameness; asked for from-scratch design inspired by Reddit, Google Calendar, etc.

## Runners

| Candidate | Agent | World | Signature | CSS |
|-----------|-------|-------|-----------|-----|
| 1 | Codex gpt-5.6-sol | Registrar Desk / Calendar-first | Week grid first; Omnivox drawer | ~2597 |
| 2 | Codex gpt-5.6-sol | Registrar Commons / Discourse dens | Dark rail + Reddit/Discourse topic ledger | ~2788 |
| 3 | Grok grok-4.6 | Availability workshop | When2meet person stations + gap matrix | ~1496 |
| 4 | Grok grok-4.6 | Linear workspace | 36px rail + week canvas + paste inspector | ~1928 |

Round 1 archived: `visual-preview/archive-round1-lookalike/`

## Visual differentiation check (screenshots)

- **C1 Schedule:** Full week with now-line, conflicts, import drawer — not a textarea-first page
- **C2 Forum:** Dense topic table (Topic / Category / Course / Replies / Latest) + composer
- **C3 Free time:** 3 person paste columns + shared-gap week matrix
- **C4 Schedule:** Week/List toolbar + right Omnivox inspector

## Hub

http://127.0.0.1:8765/

## Next

User picks a base; optional Round 3 polish on chosen candidate only; then implement in `src/routes/tools/`.
