# MariTools full verification checklist

Run before claiming MariTools is shippable. Every item needs fresh evidence in this session.

## 1. Unit and coverage gate

```bash
npx vitest run --coverage
```

Expect 0 failures and thresholds from `.coverage-thresholds.json`.

## 2. Route health (no DATABASE_URL)

Every route must return **200** and render MariTools chrome, not the site-wide 500 page.

```bash
for path in \
  /tools \
  /tools/schedule \
  /tools/free-time \
  /tools/semester \
  /tools/catalog \
  /tools/clubs \
  /tools/account \
  /tools/forum
do
  code=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:4173$path")
  echo "$code $path"
done
```

DB-backed pages may show an inline unavailable alert. They must not 500.

## 3. E2E schedule flow

```bash
npm run test:e2e -- tests/e2e/maritools-schedule.spec.js
```

## 4. Focus styling audit

On each inner page, Tab to at least one `input`, `select`, `textarea`, and primary `button`.

Pass when focused form controls show a soft signal ring (`border-color: var(--signal)` + pale blue `box-shadow`), not the site-wide club-blue offset outline.

Pages: schedule import drawer, free-time paste fields, semester upload, catalog filters, forum toolbar, clubs filters, account profile fields.

## 5. Visual tab matrix

| Route | Shell | Inner chrome | Key interaction |
| --- | --- | --- | --- |
| `/tools` | Sidebar + home intro | Today ticket | Links to each tool |
| `/tools/schedule` | Yes | Week heading + calendar | Import drawer + paste |
| `/tools/free-time` | Yes | Paint grid or empty | Two schedule fields |
| `/tools/semester` | Yes | Course stack | Upload control visible |
| `/tools/catalog` | Yes | Titlebar + filters | Search + discipline |
| `/tools/clubs` | Yes | Directory columns | Filter row |
| `/tools/forum` | Yes | Tabs + toolbar | Search + course filter |
| `/tools/account` | Yes | Settings sheet | Sign-in or profile form |

Capture screenshots to `.artifacts/verify-mariTools/<route>/` after focus audit.

## 6. With DATABASE_URL (optional)

```bash
npx vitest run src/lib/server/maritools/repository.integration.test.js
```

Re-run route health on preview. Populated rows should appear when seed data exists.
