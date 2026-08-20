# Marianopolis Programming Club

## Product purpose

This website is the public home of the Marianopolis Programming Club. Its primary job is to help Marianopolis students understand the club and sign up. Its secondary job is to provide useful club services and learning material, including the Book Delivery service.

## Primary users

- Marianopolis students who are curious about programming, including complete beginners
- Current club members looking for workshops, resources, events, and community links
- Students buying required French and English course books through Book Delivery
- Approved club staff managing the catalogue, paid orders, and campus pickup

## Primary outcomes

1. A prospective member quickly understands what the club does and can open the member registration form.
2. A student can find the club's Instagram and Discord without those links competing with the primary sign-up action.
3. A member can reach workshop material, programming resources, and confirmed event information.
4. A Book Delivery customer can choose a teacher-course list, select books, review a cart, pay through hosted Stripe checkout, receive an email receipt, and understand the Marianopolis pickup process.
5. Approved staff can manage the real catalogue and move paid orders through the manual purchasing and pickup workflow without changing provider-owned payment state.

## Product position

The club is a peer learning community where students can get motivated to code, get help while building, and take part in workshops, mini-competitions, and MariHacks. Prior programming experience is not required.

## Information architecture

- Home: programming club recruitment and evidence of what members do
- About: the club's purpose and how participation works
- Events: confirmed dates only, with the workshop archive available when no current event is published
- Workshops: original club learning material organized for browsing
- Resources: curated programming references
- Book Delivery: a distinct transactional flow for course books
- Staff: a private order and catalogue workspace available only to the verified team account

## Current launch state

The programming club site is ready to stand on its own while Book Delivery remains `Coming Soon`. In that state, the homepage keeps the service visible, but dedicated Book Delivery routes close before catalogue, database, or Stripe work. The staff portal, signed Stripe webhook, and authenticated recovery job remain separate operational surfaces.

Moving Book Delivery to `live` requires the legal, tax, refund, Stripe, database recovery, catalogue, and Wayne's Front Desk approvals in the deployment runbook. Missing or invalid launch configuration stays closed.

## Book Delivery requirements

- One catalogue entry per teacher and course
- Each entry shows the assigned books and useful price information
- Course detail lets students include or exclude individual books
- Every book supports a bookstore link
- The cart appears only inside Book Delivery
- The service fee is charged once per bookstore, normally $5 to $7
- Purchasing is handled manually after payment
- Guest checkout is the default
- Stripe is the card-payment provider and supplies email receipts
- Pickup is at Wayne's Front Desk at Marianopolis College
- Pickup information belongs in checkout, order review, and confirmation, not the course-detail page
- Payment state comes only from signed Stripe evidence or authenticated provider reconciliation
- Customer confirmation uses a short-lived, hashed capability and never a Stripe Session ID in the URL
- Customer identity is anonymized after the documented 90-day retention period while finance and audit facts remain

## Staff operations

- Only the verified Google identity `team@marihacks.com` can receive a staff session.
- Every protected load and action rechecks authorization on the server.
- Fulfillment moves in order from unstarted to purchasing, received, ready for pickup, and picked up.
- Staff cancellation first confirms provider expiry. A paid provider result always takes precedence.
- Refunds start in Stripe Dashboard and enter the ledger through a verified webhook.
- Order lines and audit history are append-only records.

## Verified destinations

- Member registration form: https://docs.google.com/forms/d/e/1FAIpQLScgamwSUyaJO6wyY0w2KPxsJ_l7wdORyR37vhuHn209l7os0g/viewform?usp=header
- Instagram: https://www.instagram.com/mari_programming_club/
- Discord: https://discord.gg/c6JJw9d

## Content evidence

- The existing site and club archive provide real workshop and resource material.
- A Programming Club introduction deck identifies the Programming Hub, peer help, workshops, mini-competitions, MariHacks, and beginner accessibility as club activities.
- Old meeting schedules, deadlines, and event counts are not current evidence and must not appear as live facts without confirmation.
- Empty event states must remain factual and must not imply dates that have not been published.

## Product constraints

- The top-right primary action is `Sign up` and opens the verified member registration form.
- Instagram and Discord are icon links with accessible names.
- Book Delivery remains clearly connected to the club but should not displace recruitment on the homepage.
- Existing workshop and resource destinations should remain functional during the redesign.
- The service must remain usable on mobile and with keyboard navigation, visible focus, reduced motion, and screen-reader labels.

## Success criteria

- A first-time visitor can describe the club and find sign-up without scrolling through filler.
- Each page presents useful information or actions without ornamental copy.
- Book Delivery supports the complete teacher-course-to-payment flow without requiring an account.
- The site never presents stale dates or invented club activity as current fact.
