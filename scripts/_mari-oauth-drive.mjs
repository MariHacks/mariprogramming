import { chromium } from 'playwright';

const CLIENT_ID_PROD = '245259091681-u8r7onedbsvjepgn07b638l4hq1aqi7m.apps.googleusercontent.com';
const ORIGIN = 'http://127.0.0.1:5174';
const REDIRECT = 'http://127.0.0.1:5174/api/auth/callback/google';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('google')) || context.pages()[0];
console.log('start url:', page.url());

async function dump(label) {
  const text = await page.locator('body').innerText().catch(() => '');
  console.log(`\n=== ${label} ===`);
  console.log('url:', page.url());
  console.log('title:', await page.title());
  console.log('text:', text.slice(0, 1500).replace(/\n+/g, ' | '));
}

await dump('initial');

// Account chooser: pick team@marihacks.com
if (page.url().includes('accountchooser') || page.url().includes('signin')) {
  const team = page.locator('[data-identifier="team@marihacks.com"], [data-email="team@marihacks.com"]');
  if (await team.count()) {
    await team.first().click();
    await page.waitForTimeout(4000);
  } else {
    // fallback click by text
    const byText = page.getByText('team@marihacks.com', { exact: false });
    if (await byText.count()) {
      await byText.first().click();
      await page.waitForTimeout(4000);
    }
  }
  await dump('after-account');
}

// If password wall, STOP
const body = await page.locator('body').innerText();
if (/Enter your password|Too many failed attempts|Verify it.?s you/i.test(body) && !/Credentials|OAuth 2\.0 Client IDs|Create credentials/i.test(body)) {
  console.log('BLOCKER: password/verify screen');
  await page.screenshot({ path: '/tmp/mari-oauth-blocker.png', fullPage: true });
  process.exit(2);
}

// Navigate to credentials if needed
if (!/credentials/i.test(page.url()) || !/marihacks/i.test(await page.title() + page.url())) {
  await page.goto('https://console.cloud.google.com/apis/credentials?project=marihacks-website', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await dump('credentials-nav');
}

const body2 = await page.locator('body').innerText();
if (/Enter your password|Too many failed attempts/i.test(body2) && !/OAuth 2\.0 Client IDs/i.test(body2)) {
  console.log('BLOCKER after nav');
  await page.screenshot({ path: '/tmp/mari-oauth-blocker.png', fullPage: true });
  process.exit(2);
}

await page.screenshot({ path: '/tmp/mari-oauth-creds.png', fullPage: true });

// Open existing client edit page directly
const editUrl = `https://console.cloud.google.com/apis/credentials/oauthclient/${CLIENT_ID_PROD}?project=marihacks-website`;
await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
await dump('edit-client');
await page.screenshot({ path: '/tmp/mari-oauth-edit.png', fullPage: true });

// Collect all input values that look like origins/redirects
const inputs = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('input').forEach((el, i) => {
    const v = el.value || '';
    if (!v) return;
    out.push({ i, type: el.type, name: el.name || '', aria: el.getAttribute('aria-label') || '', v: v.slice(0, 200) });
  });
  return out;
});
console.log('inputs:', JSON.stringify(inputs, null, 2));

// Find local URLs and clear them
const localPatterns = [
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5174/api/auth/callback/google',
  'http://localhost:5174',
  'http://localhost:5174/api/auth/callback/google',
];

const scrubbed = await page.evaluate((locals) => {
  const removed = [];
  // Google console often uses chips/list rows with delete buttons next to URIs
  const all = Array.from(document.querySelectorAll('input, textarea'));
  for (const el of all) {
    const v = (el.value || '').trim();
    if (locals.some(l => v === l || v.includes('127.0.0.1:5174') || v.includes('localhost:5174'))) {
      removed.push(v);
      el.focus();
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  // Also look for list items containing local URLs with nearby delete/clear buttons
  const nodes = Array.from(document.querySelectorAll('div, li, span, md-list-item'));
  for (const n of nodes) {
    const t = (n.innerText || '').trim();
    if (!t || t.length > 200) continue;
    if (/127\.0\.0\.1:5174|localhost:5174/.test(t)) {
      const btn = n.querySelector('button, [role="button"], .delete, [aria-label*="Delete"], [aria-label*="Remove"], [icon="delete"]')
        || n.parentElement?.querySelector('button[aria-label*="Delete"], button[aria-label*="Remove"], button[aria-label*="Clear"]');
      if (btn) {
        btn.click();
        removed.push('clicked-delete:' + t);
      }
    }
  }
  return removed;
}, localPatterns);
console.log('scrub attempts:', scrubbed);

await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/mari-oauth-edit-scrubbed.png', fullPage: true });

// Click Save if we scrubbed something, or if save enabled
const saveBtn = page.getByRole('button', { name: /Save/i });
if (await saveBtn.count()) {
  const disabled = await saveBtn.first().isDisabled().catch(() => false);
  console.log('save disabled?', disabled);
  if (!disabled && scrubbed.length) {
    await saveBtn.first().click();
    await page.waitForTimeout(3000);
    console.log('saved scrub');
  }
}

await dump('after-scrub');

// Create new client
await page.goto('https://console.cloud.google.com/apis/credentials/oauthclient?project=marihacks-website', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await dump('create-page');
await page.screenshot({ path: '/tmp/mari-oauth-create.png', fullPage: true });

// Select Web application application type if needed
const webRadio = page.getByText('Web application', { exact: false });
if (await webRadio.count()) {
  await webRadio.first().click();
  await page.waitForTimeout(1000);
}

// Name field
const nameInput = page.locator('input').filter({ has: page.locator('xpath=..') });
// Try labeled name
let named = false;
for (const sel of [
  'input[aria-label*="Name" i]',
  'input[formcontrolname="displayName"]',
  'input[name="displayName"]',
  'mat-form-field input',
]) {
  const el = page.locator(sel).first();
  if (await el.count()) {
    await el.fill('MariProgramming local');
    named = true;
    console.log('filled name via', sel);
    break;
  }
}
if (!named) {
  // first visible text input
  const inputs2 = page.locator('input[type="text"]:visible');
  const n = await inputs2.count();
  console.log('visible text inputs', n);
  if (n > 0) {
    await inputs2.first().fill('MariProgramming local');
  }
}

// Add JS origin and redirect - console UI varies; try common patterns
async function addUri(sectionHint, value) {
  // Click ADD URI near section
  const section = page.getByText(sectionHint, { exact: false }).first();
  if (await section.count()) {
    await section.scrollIntoViewIfNeeded();
  }
  // Look for Add URI buttons
  const addButtons = page.getByRole('button', { name: /Add URI|ADD URI|\+/i });
  const count = await addButtons.count();
  console.log('add buttons', count, 'for', sectionHint);
  // Fill empty inputs near section
  const filled = await page.evaluate(({ hint, value }) => {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,div,span,label')).filter(e => (e.innerText||'').includes(hint));
    let root = headings[0];
    for (let i=0;i<8 && root;i++) {
      const inputs = root.querySelectorAll('input');
      for (const inp of inputs) {
        if (!inp.value) {
          inp.focus();
          const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          native.set.call(inp, value);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          return { ok: true, method: 'empty-input' };
        }
      }
      // click add
      const btn = Array.from(root.querySelectorAll('button')).find(b => /Add URI|ADD/i.test(b.innerText||b.getAttribute('aria-label')||''));
      if (btn) btn.click();
      root = root.parentElement;
    }
    return { ok: false };
  }, { hint: sectionHint, value });
  console.log('addUri', sectionHint, filled);
  await page.waitForTimeout(500);
  if (!filled.ok) {
    // last resort: fill any empty visible input after clicking Add URI once
    if (await addButtons.count()) {
      await addButtons.first().click();
      await page.waitForTimeout(500);
    }
    await page.evaluate((value) => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      const empty = inputs.find(i => !i.value && i.offsetParent);
      if (empty) {
        const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        native.set.call(empty, value);
        empty.dispatchEvent(new Event('input', { bubbles: true }));
        empty.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, value);
  }
}

await addUri('Authorized JavaScript origins', ORIGIN);
await addUri('Authorized redirect URIs', REDIRECT);
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/mari-oauth-create-filled.png', fullPage: true });

// Dump inputs again
const createInputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(el => ({
  v: el.value, aria: el.getAttribute('aria-label'), name: el.name, type: el.type
})).filter(x => x.v));
console.log('create inputs:', JSON.stringify(createInputs, null, 2));

const createBtn = page.getByRole('button', { name: /Create/i });
if (await createBtn.count()) {
  const dis = await createBtn.first().isDisabled().catch(() => false);
  console.log('create disabled?', dis);
  if (!dis) {
    await createBtn.first().click();
    await page.waitForTimeout(5000);
  }
}
await dump('after-create');
await page.screenshot({ path: '/tmp/mari-oauth-created.png', fullPage: true });

// Extract client id/secret from modal or page
const secrets = await page.evaluate(() => {
  const text = document.body.innerText;
  const idMatch = text.match(/[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com/);
  const secretMatch = text.match(/GOCSPX-[A-Za-z0-9_-]+/) || text.match(/Client secret\s*\n?\s*([A-Za-z0-9_-]+)/i);
  // Also check inputs
  const inputs = Array.from(document.querySelectorAll('input')).map(i => i.value);
  return {
    textSlice: text.slice(0, 3000),
    idMatch: idMatch && idMatch[0],
    secretMatch: secretMatch && (secretMatch[1] || secretMatch[0]),
    inputs
  };
});
console.log('SECRETS_JSON:' + JSON.stringify(secrets));

await browser.close().catch(() => {});
