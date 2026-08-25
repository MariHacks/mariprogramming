# Cross-judge verdict

Scores are 1–5, where 5 best satisfies the criterion.

| Candidate | 1. Routes + shell | 2. CSS token architecture | 3. Constraints | 4. Implementability | 5. Design alignment | 6. Extendability | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Candidate 1 | 5 | 5 | 5 | 5 | 5 | 5 | **30** |
| Candidate 2 | 5 | 5 | 5 | 4 | 5 | 5 | **29** |
| Candidate 3 | 5 | 3 | 4 | 5 | 5 | 4 | **26** |
| Candidate 4 | 5 | 3 | 3 | 4 | 4 | 5 | **24** |

## Assessment

- **Candidate 1:** Complete route and shell coverage, with clear Operate jobs, sequences, responsive behavior, keyboard handling, reduced motion, and route-specific states. It cleanly scopes shared `--mt-*` foundations to `.mt-shell`, then names exact route tokens for every page. Its `Mt*` vocabulary is comprehensive without fragmenting the system. It also handles automatic term resolution correctly, keeps Account in the site header, and makes textbook content unambiguously non-commercial.
- **Candidate 2:** Nearly as strong and equally complete. Shared foundations, per-route tokens, component contracts, acceptance checks, and state coverage are excellent. It loses one implementability point for avoidable ambiguity and assumptions, notably the 12-column Semester allocation totaling 14 columns and the hard-coded 8 MB limit rather than tying copy to server policy.
- **Candidate 3:** Highly concrete, especially its CSS geometry and `MtWeekGrid`, and faithful to Campus Lab Manual. However, page-specific dimensions are mixed into the shared token table or left inline instead of forming an explicit route-token layer. It also specifies center-dot metadata separators, conflicting with the UI copy constraint and weakening the otherwise disciplined shared grammar.
- **Candidate 4:** Strong single mental model: TOC shell, ruled lists/forms, and one week-grid component with two semantic modes. Its token system is mostly one global table rather than an explicit shared-versus-route architecture. More seriously, Schedule and Free Time preserve copy telling users to choose a term in a nonexistent tools bar, creating a direct implementation contradiction; it also specifies center-dot metadata separators.

## Recommended base

**Use candidate 1 as the base.** It is the most implementation-ready specification with no material product contradiction: all routes are task-first, shared and page-specific CSS responsibilities are explicit, constraints are enforced in shell and route copy, and the reusable `Mt*` vocabulary gives future tools one coherent extension model.
