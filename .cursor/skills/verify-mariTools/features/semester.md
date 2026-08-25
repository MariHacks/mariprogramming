# Semester + NIM

Upload a text PDF course outline, review extraction proposals, opt in to catalog.

## Sub-features

- `semester-upload` — PDF text extracted locally.
- `semester-nim` — cold/warm cache by SHA-256 and offering.
- `semester-contribute` — structured catalog opt-in.

## How to get to it (user POV)

- `/tools/semester` after account completion and NIM disclosure.

## Driving it with browser MCP

Preconditions: signed-in profile, `DATABASE_URL`, `NVIDIA_NIM_API_KEY` for live NIM proof.

- Upload text PDF outline.
- Review proposed assessments/books; edit if needed.
- Opt in to catalog contribute.
- Re-upload same file → cache hit (instrument inference count).
- Scanned PDF → clear error asking for text PDF.

Proof: DB row in `mt_outline_extractions`; NIM call count log; catalog entry on `/tools/catalog`.

## Gotchas

- NIM is server-side only; key never in client bundle.
- Missing key: upload still works with manual edit path.
