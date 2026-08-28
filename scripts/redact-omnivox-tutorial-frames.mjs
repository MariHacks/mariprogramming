#!/usr/bin/env node
/**
 * Rebuild static/maritools/omnivox/step-NN.webp from Scribe raw captures.
 *
 * Per step: PII redaction → crop/zoom → press highlight → macOS browser chrome.
 * Login-side photos are kept. Student names/numbers and login field values stay covered.
 *
 * Usage:
 *   node scripts/redact-omnivox-tutorial-frames.mjs
 *   RAW_DIR=.artifacts/scribe-omnivox-raw node scripts/redact-omnivox-tutorial-frames.mjs
 *
 * Requires: tesseract, cwebp, Python Pillow.
 * Exits non-zero if post-redaction OCR still finds student PII.
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = process.env.RAW_DIR
	? join(root, process.env.RAW_DIR)
	: join(root, '.artifacts', 'scribe-omnivox-raw');
const OUT_DIR = join(root, 'static', 'maritools', 'omnivox');
const WORK_DIR = join(root, '.artifacts', 'scribe-omnivox-work');
const TARGET = [1200, 872];
const CHROME_H = 52;
const URL_HOST = 'marianopolis.omnivox.ca';

/**
 * Per-step compose plan on raw 2252×1638.
 * redactionsctions: [x0,y0,x1,y1,fill] in raw coords (white|panel|header)
 * crop: [x0,y0,x1,y1] raw window to keep (zoom)
 * highlight: [x0,y0,x1,y1] raw press target, or null
 */
const STEPS = {
	1: {
		// Full login; photo panel stays visible. No click target (open URL).
		crop: [0, 40, 2252, 1580],
		redactions: [
			[1320, 630, 2050, 780, 'white'],
			[1320, 820, 2050, 980, 'white']
		],
		highlight: null
	},
	2: {
		// Emphasize login form; keep left photo. Highlight Student number field.
		crop: [0, 180, 2252, 1400],
		redactions: [
			[1320, 630, 2050, 780, 'white'],
			[1320, 820, 2050, 980, 'white']
		],
		highlight: [1320, 590, 2080, 770]
	},
	3: {
		// Same login frame; highlight Log In.
		crop: [0, 180, 2252, 1400],
		redactions: [
			[1320, 630, 2050, 780, 'white'],
			[1320, 820, 2050, 980, 'white'],
			// Scribe capture tip over the login chrome
			[1550, 90, 2200, 390, 'white']
		],
		highlight: [1830, 990, 2065, 1120]
	},
	4: {
		// Sidebar + a strip of home for aspect; highlight Course Schedule.
		crop: [0, 0, 1100, 1400],
		redactions: [[1180, 8, 1620, 120, 'white']],
		highlight: [95, 855, 345, 915]
	},
	5: {
		// Semester form; cut empty bottom. Highlight Obtain my schedule.
		crop: [480, 160, 1900, 740],
		redactions: [[1440, 8, 1800, 120, 'white']],
		highlight: [1440, 645, 1775, 725]
	},
	6: {
		// Yellow printer banner + personal data strip. Highlight banner.
		crop: [300, 310, 1700, 760],
		redactions: [
			[860, 560, 1140, 660, 'white'],
			[960, 615, 1120, 660, 'white']
		],
		highlight: [340, 340, 810, 470]
	},
	7: {
		// Compact option page; cut blank bottom. Highlight Compact radio.
		crop: [560, 40, 1690, 840],
		redactions: [[940, 95, 1160, 145, 'white']],
		highlight: [595, 630, 1145, 700]
	},
	8: {
		// Same page; highlight View.
		crop: [560, 40, 1690, 840],
		redactions: [[940, 95, 1160, 145, 'white']],
		highlight: [1545, 745, 1685, 825]
	},
	9: {
		// Numbered course list (copy target); cut empty footer.
		crop: [900, 40, 1800, 1080],
		redactions: [[900, 105, 1360, 170, 'white']],
		highlight: [1180, 190, 1780, 1050]
	}
};

/** Patterns that must not appear in shipped OCR (institution "Marianopolis" allowed). */
const FORBIDDEN = [
	/\bzhi\b/i,
	/\bcheng\b/i,
	/\b2530622\b/,
	/\bmarianoj\b/i,
	/\bmarianoy\b/i,
	/\bmariano\b(?!polis)/i
];

mkdirSync(WORK_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

if (!existsSync(join(RAW_DIR, 'step-01.png'))) {
	console.error(`Missing raw frames in ${RAW_DIR}`);
	process.exit(1);
}

const py = `
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

raw_dir = Path(${JSON.stringify(RAW_DIR)})
work = Path(${JSON.stringify(WORK_DIR)})
out_dir = Path(${JSON.stringify(OUT_DIR)})
target_w, target_h = ${JSON.stringify(TARGET)}
chrome_h = ${CHROME_H}
url_host = ${JSON.stringify(URL_HOST)}
steps = json.loads(${JSON.stringify(JSON.stringify(STEPS))})
fills = {
    'white': (255, 255, 255, 255),
    'panel': (232, 236, 240, 255),
    'header': (255, 255, 255, 255),
}

def draw_highlight(im, box):
    """Blue focus ring + soft glow over the press target."""
    x0, y0, x1, y1 = [int(v) for v in box]
    pad = 10
    x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    overlay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for i, alpha in ((18, 35), (12, 55), (6, 80)):
        d.rounded_rectangle(
            [x0 - i, y0 - i, x1 + i, y1 + i],
            radius=14 + i // 2,
            outline=(20, 87, 217, alpha),
            width=3,
        )
    d.rounded_rectangle(
        [x0, y0, x1, y1],
        radius=12,
        outline=(20, 87, 217, 230),
        width=5,
        fill=(20, 87, 217, 28),
    )
    return Image.alpha_composite(im.convert('RGBA'), overlay)

def fit_cover(im, box_w, box_h, focus=None):
    """Scale to fill the viewport; bias crop toward an optional focus box."""
    w, h = im.size
    scale = max(box_w / w, box_h / h)
    nw, nh = max(box_w, int(round(w * scale))), max(box_h, int(round(h * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS).convert('RGB')
    if focus:
        fx = int(((focus[0] + focus[2]) / 2) * scale)
        fy = int(((focus[1] + focus[3]) / 2) * scale)
        ox = min(max(0, fx - box_w // 2), max(0, nw - box_w))
        oy = min(max(0, fy - box_h // 2), max(0, nh - box_h))
    else:
        ox, oy = (nw - box_w) // 2, (nh - box_h) // 2
    return resized.crop((ox, oy, ox + box_w, oy + box_h))

def compose_chrome(content, focus=None):
    """macOS-style browser chrome around content. Output target_w x target_h."""
    W, H = target_w, target_h
    canvas = Image.new('RGB', (W, H), (232, 234, 238))
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle([0, 0, W - 1, H - 1], radius=10, fill=(246, 246, 248), outline=(170, 175, 185))
    draw.rectangle([1, 1, W - 2, chrome_h], fill=(236, 236, 240))
    draw.line([(1, chrome_h), (W - 2, chrome_h)], fill=(198, 200, 206), width=1)

    lights = [(14, 26, (255, 95, 87)), (34, 26, (254, 188, 46)), (54, 26, (40, 200, 64))]
    for cx, cy, color in lights:
        draw.ellipse([cx, cy, cx + 12, cy + 12], fill=color)

    pill_w, pill_h = 420, 26
    px = (W - pill_w) // 2
    py = (chrome_h - pill_h) // 2
    draw.rounded_rectangle([px, py, px + pill_w, py + pill_h], radius=8, fill=(255, 255, 255), outline=(210, 212, 218))
    lx, ly = px + 12, py + 7
    draw.rectangle([lx, ly + 5, lx + 8, ly + 12], outline=(120, 125, 135), width=1)
    draw.arc([lx + 1, ly, lx + 7, ly + 8], 0, 180, fill=(120, 125, 135), width=1)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 12)
    except Exception:
        try:
            font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 12)
        except Exception:
            font = ImageFont.load_default()
    draw.text((px + 28, py + 6), url_host, fill=(55, 60, 70), font=font)

    margin = 2
    vw, vh = W - margin * 2, H - chrome_h - margin
    fitted = fit_cover(content, vw, vh, focus=focus)
    canvas.paste(fitted, (margin, chrome_h))
    return canvas

for step_key, cfg in steps.items():
    step = int(step_key)
    src = raw_dir / f'step-{step:02d}.png'
    im = Image.open(src).convert('RGBA')
    draw = ImageDraw.Draw(im)
    for x0, y0, x1, y1, fill in cfg.get('redactions', []):
        draw.rectangle([x0, y0, x1, y1], fill=fills[fill])

    cx0, cy0, cx1, cy1 = cfg['crop']
    cropped = im.crop((cx0, cy0, cx1, cy1))

    local_focus = None
    hi = cfg.get('highlight')
    if hi:
        hx0, hy0, hx1, hy1 = hi
        local_focus = [hx0 - cx0, hy0 - cy0, hx1 - cx0, hy1 - cy0]
        cropped = draw_highlight(cropped, local_focus)

    framed = compose_chrome(cropped, focus=local_focus)
    png_path = work / f'redacted-{step:02d}.png'
    framed.save(png_path)
    print(png_path)
`;

const pyRun = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
if (pyRun.status !== 0) {
	console.error(pyRun.stderr || pyRun.stdout);
	process.exit(pyRun.status ?? 1);
}

const proof = [];
let failed = false;

for (let step = 1; step <= 9; step++) {
	const pad = String(step).padStart(2, '0');
	const pngPath = join(WORK_DIR, `redacted-${pad}.png`);
	const webpPath = join(OUT_DIR, `step-${pad}.webp`);
	const jpgPath = join(WORK_DIR, `ocr-${pad}.jpg`);
	const tsvBase = join(WORK_DIR, `gate-${pad}`);

	const webp = spawnSync('cwebp', ['-quiet', '-q', '90', pngPath, '-o', webpPath], {
		encoding: 'utf8'
	});
	if (webp.status !== 0) {
		console.error(webp.stderr || webp.stdout);
		process.exit(webp.status ?? 1);
	}

	spawnSync(
		'python3',
		[
			'-c',
			`from PIL import Image; Image.open(${JSON.stringify(pngPath)}).convert('RGB').save(${JSON.stringify(jpgPath)}, quality=92)`
		],
		{ encoding: 'utf8' }
	);
	spawnSync('tesseract', [jpgPath, tsvBase, '--psm', '6', 'tsv'], {
		encoding: 'utf8',
		stdio: ['ignore', 'ignore', 'ignore']
	});

	const tsv = readFileSync(`${tsvBase}.tsv`, 'utf8');
	const words = tsv
		.split('\n')
		.slice(1)
		.map((line) => line.split('\t')[11] || '')
		.filter(Boolean);
	const text = words.join(' ');
	const hits = FORBIDDEN.filter((re) => re.test(text)).map((re) => String(re));

	const line = {
		step,
		webp: webpPath,
		hits,
		marianoFamily: (text.match(/mariano\w*/gi) || []).slice(0, 8),
		sample: words.filter((w) => /mari|zhi|cheng|2530|student/i.test(w)).slice(0, 12)
	};
	proof.push(line);
	console.log(
		`step-${pad}: hits=${hits.length ? hits.join(',') : 'none'} mariano*=${JSON.stringify(line.marianoFamily)}`
	);
	if (hits.length) failed = true;
}

const proofPath = join(WORK_DIR, 'ocr-gate-proof.json');
writeFileSync(proofPath, JSON.stringify({ ok: !failed, proof }, null, 2));
console.log('wrote', proofPath);

if (failed) {
	console.error('OCR gate FAILED: forbidden PII still present');
	process.exit(2);
}

console.log('OCR gate PASS');
