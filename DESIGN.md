## <!-- SEED: established with the user before implementation; re-run $impeccable document once there's code to capture the actual tokens and components. -->

name: Marianopolis Programming Club
description: A contemporary student technical journal for learning, community, and useful club services.

---

# Design System: Marianopolis Programming Club

## Overview

**Creative North Star: "The Student Technical Journal"**

The website should feel like a current university publication made by technically serious students: direct, useful, confident, and alive without becoming theatrical. Editorial hierarchy and precise information design create interest. The interface uses the user's independent-bookstore and high-contrast checkout references as its craft bar, while translating them into one coherent club identity.

Content sits in open compositions, ruled rows, and deliberate columns rather than a collection of floating cards. The programming club leads the public experience; Book Delivery adopts the same typography and grid while becoming denser and more transactional. Imagery is evidence: book covers, workshop material, and real club assets. Decorative illustration is not required to make an empty section feel complete.

Motion communicates state and continuity. Pointer-down feedback is immediate, route and cart changes settle quickly, and payment progress is calm and explicit. No animation exists only to decorate the page.

**Key Characteristics:**

- Editorial hierarchy with compact, useful density
- Cool white, ink navy, quiet gray, and a rare electric blue accent
- Open layouts and ruled groupings instead of repeated cards
- Modern grotesk typography with tight display rhythm and highly readable body copy
- Functional motion that remains complete with reduced motion enabled

## Colors

The palette is cool and high-contrast. Exact values are provisional until the first implementation establishes them.

### Primary

- **Electric Signal Blue**: Primary actions, selected states, links requiring emphasis, and concise route feedback.

### Neutral

- **Cool Paper**: Main reading and form surfaces.
- **Ink Navy**: Primary text, navigation, checkout summary surfaces, and the footer.
- **Quiet Steel**: Secondary text, dividers, and low-priority controls.
- **Mist**: Subtle grouping, hover state, and alternating transactional rows where a boundary needs more than a rule.

**The Signal Rule.** Electric blue is a scarce signal, not a background theme. Most screens remain paper and ink so the primary action is unmistakable.

**The No Beige Rule.** Warm cream, parchment, and tan surfaces are not part of this visual world.

## Typography

**Display Font:** Inter Tight with a modern sans-serif fallback

**Body Font:** Inter with a modern sans-serif fallback

**Label/Mono Font:** Roboto Mono only for literal code, course codes, order references, and compact technical identifiers

**Character:** Display type is concise and slightly compressed; body type is neutral and easy to scan. The pairing should resemble a well-edited contemporary publication, not a coding toy or developer-console theme.

### Hierarchy

- **Display:** Large, tight, and left-aligned. Used once per major landing surface.
- **Headline:** Strong enough to organize a page without requiring a colored panel behind it.
- **Title:** Used for courses, workshops, and transactional groups.
- **Body:** Comfortable reading measure with short, factual paragraphs.
- **Label:** Sentence case by default. Uppercase is limited to compact identifiers where it improves scanning.

**The Useful Type Rule.** Every typographic style must express hierarchy or state. Decorative eyebrow layers and trailing rules are not reintroduced.

## Layout

Pages use a flexible editorial grid with a readable central measure and strong alignment between header, primary content, and footer. Large sections gain substance through topology, sequence, and evidence rather than oversized vertical padding.

Club pages mix a primary reading column with narrow fact, destination, or archive columns. Workshop and resource pages use ruled indexes and grouped rows. Book Delivery uses open teacher-course compositions with stacked cover imagery and aligned pricing. Checkout and confirmation use a high-contrast two-column workspace: a bright task pane and a deep-ink review or pickup rail.

On small screens, columns collapse in reading order, ruled rows remain intact, and the transactional summary follows the form without becoming a separate floating card. No horizontal layout depends on hover or a fine pointer.

The staff portal uses the same publication grid with tighter operational density. Order state, customer facts, purchase groups, and audit history are separated by headings and rules instead of dashboard cards. Sensitive recovery and error states stay short, specific, and free of provider details.

When Book Delivery is closed, the public homepage uses the plain `Coming Soon` status already present in the reference composition. Dedicated routes do not render a second promotional landing page.

## Elevation & Depth

The system is flat by default. Structure comes from contrast, rules, alignment, crop, and occasional tonal layering. Shadows are reserved for book covers and transient overlays where physical separation is meaningful.

**The Flat-by-Default Rule.** Static content does not float. A shadow must explain physical depth or active state.

## Shapes

Corners are mostly square or lightly eased. Controls may use a restrained small radius for comfort and focus visibility, but large rounded containers and pill-shaped decoration do not define page structure. Book covers retain their natural rectangular silhouette.

**The Container Rule.** A border or background must group related information or establish interaction. It may not exist merely to turn content into a card.

## Do's and Don'ts

### Do:

- **Do** lead the homepage with programming club recruitment and one clear Sign up action.
- **Do** use real workshop, resource, course, price, and pickup information as visual evidence.
- **Do** treat Instagram and Discord as accessible icon links.
- **Do** keep transactional information dense, aligned, and easy to verify.
- **Do** provide immediate press feedback and visible keyboard focus.

### Don't:

- **Don't** use beige, warm parchment, pastel section bands, or cartoon illustration.
- **Don't** repeat rounded cards across a page to manufacture visual interest.
- **Don't** fill sparse pages with ornamental copy, oversized gaps, or decorative labels.
- **Don't** animate background decoration, loop motion, or delay essential payment feedback.
- **Don't** present unverified event dates or old meeting schedules as current.
