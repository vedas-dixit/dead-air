# Requirements Document

## Introduction

The front page sprout is spec 11 for Dead Air, and the second one after the front page itself. A hand-drawn flower grows out of one word on the front page: a stem draws up from the top of the word's first letter, two leaves open, the head opens, and a warm glow comes up behind it. It is the flower that grows out of the "l" of "life" on the author page of blog.vedasdixit.com, drawn by the owner.

The word is not fixed by this spec. The owner names it when starting the work. It is called the Target_Word below.

Everything the page needs already exists as finished, tested code in `docs/design/sprout/kit/`, with a guide in `docs/design/sprout/guide.md`. This spec copies that kit into the source, puts one anchor in `index.html`, and wires it in `src/front/main.ts`. It writes no new drawing code.

### What the code already has

- `index.html` is the front page. Its headline wraps the word "dies" in its own element, `<span id="dies" data-text="front.s1.h.dies">dies</span>`, which front-page Requirement 2.3 left for "a later spec".
- `src/front/dom/bind-text.ts` sets `textContent` on every `[data-text]` element when the language changes. Anything inside such an element is deleted.
- `tests/front/front-css.test.ts` fails if `src/front/front.css` contains `filter`, `blur`, `gradient` or `shadow`, any colour value, or motion outside `@media (prefers-reduced-motion: no-preference)`.
- `tests/front/page.test.ts` checks that `#dies` holds only "dies" and has no style or class.
- `tests/front/no-network-source.test.ts` fails if a file in `src/front/` names `fetch(`, `XMLHttpRequest` or other network calls.
- `.kiro/steering/style-rules.md` forbids glows and blur and allows motion only where it shows something real. Its section "Exception: the front page sprout" (added with this spec) allows this one flower.
- The kit was tried against this repository before it was handed over: with the steps of `tasks.md` applied to a copy, `npm run typecheck`, `npm test` (190 files) and `npm run build` with the offline check all passed, and the flower code was only in the front page bundle.

### Decisions the owner confirmed in the request (24 Nov 2026)

1. The flower is the blog's, unchanged: same drawing, same order of growth, same 2.8 second clock. It is not redrawn or simplified.
2. It goes on the front page only, on one word that the owner names.
3. The glow and the growth are allowed by a written exception in `style-rules.md`, limited to this flower and to `src/front/sprout.css` and `src/front/dom/sprout.ts`.
4. The assets and the guide live in `docs/design/sprout/`. The code is copied from there, not rewritten.
5. Editing `index.html` and `src/front/main.ts`, which the front-page spec owns, is approved, with the smallest change: one anchor in the HTML and three lines in the script.
6. No new dependency, no build step, no network request.

## Glossary

- **Front_Page**: The page at `<base>`, built from `index.html`.
- **Target_Word**: The word the owner names for the flower.
- **Block**: The nearest element around the Target_Word that is not inline, for example the `h1` or a `p`.
- **Sprout**: The flower: one stem, two leaves, one head and one glow.
- **Drawing**: `src/front/sprout-drawing.ts`, the Sprout as data, exported from the blog.
- **Anchor**: The empty `<span class="sprout" data-sprout aria-hidden="true"></span>` straight before the Target_Word.
- **Host**: The `<span class="sprout-host">` that wraps the Anchor and the Target_Word, so they stay on one line.
- **Root**: The point where the stem starts. It sits on the top of the ink of the chosen letter.
- **Chosen_Letter**: The Target_Word's first letter, or the letter that `data-sprout-letter` names, counting from 0.
- **Clock**: The CSS number `--grow`, from 0 (nothing drawn) to 1 (finished).
- **Chosen_Language**: As defined in the languages spec: English or Hindi, switched without a reload.
- **Kit**: The files in `docs/design/sprout/kit/`.
- **Guide**: `docs/design/sprout/guide.md`.

## Requirements

### Requirement 1: The flower and where it sits

**User Story:** As the owner, I want my own flower to grow out of a word I choose, looking exactly as it does on my blog, so that the two sites share one hand-made detail.

#### Acceptance Criteria

1. THE Front_Page SHALL draw the Sprout from the Drawing, unchanged: one stem, two leaves, a head of 15 paths and one glow, in a 180 by 190 box with the Root at (84, 186).
2. THE Sprout SHALL draw its lines and shapes in the text colour (`currentColor`), and its only own colour SHALL be the glow, #F2BA65, held in the Drawing and never in a stylesheet.
3. THE `index.html` file SHALL hold the Anchor straight before the Target_Word inside a Host, written exactly as in the Guide, with no space or line break between the Anchor and the Target_Word.
4. THE Anchor SHALL NOT be inside an element that has `data-text`.
5. THE Target_Word, its `id`, its `data-text` key and the text of its Block SHALL read exactly as before.

### Requirement 2: The root on the letter

**User Story:** As a reader, I want the stem to come out of the letter itself, so that the flower looks grown from the word and not placed near it.

#### Acceptance Criteria

1. THE Sprout SHALL place its Root on the top of the ink of the Chosen_Letter, measured in the Chosen_Letter's own font.
2. THE Root and the size of the Sprout SHALL be set in em of the Target_Word's text, so that they follow the text size, including 200 percent text.
3. WHEN the Chosen_Language changes, THE Sprout SHALL move its Root to the new word's Chosen_Letter without a reload.
4. WHEN the fonts finish loading or the Block changes size, THE Sprout SHALL measure the Root again.
5. IF the Chosen_Letter has no ink or cannot be measured, THEN THE Sprout SHALL keep its default Root and not fail.

### Requirement 3: Growing

**User Story:** As a reader, I want the flower to grow slowly when I reach it, so that it feels alive and not like an image.

#### Acceptance Criteria

1. WHEN the Sprout is on screen from Root to top, THE Clock SHALL run from 0 to 1 over 2.8 seconds with the easing `cubic-bezier(0.3, 0.1, 0.3, 1)`.
2. WHEN no part of the Sprout is on screen, THE Clock SHALL return to 0 at once, so that the Sprout grows again when it comes back.
3. THE Sprout SHALL grow in this order: the stem, the two leaves, the head, then the glow.
4. THE Sprout SHALL NOT loop, and THE Front_Page SHALL add no other motion for it.
5. WHERE part of the Sprout's box is off the side of the screen, THE Sprout SHALL still grow when it is on screen from Root to top.

### Requirement 4: Reduced motion and no script

**User Story:** As a reader who turned motion off, I want to see the flower without any movement.

#### Acceptance Criteria

1. WHILE the reader has `prefers-reduced-motion: reduce`, THE Front_Page SHALL show the finished Sprout and nothing SHALL move.
2. THE `src/front/sprout.css` file SHALL declare every transition inside `@media (prefers-reduced-motion: no-preference)`.
3. WHERE scripts do not run, THE Front_Page SHALL show its text unchanged and no Sprout.

### Requirement 5: Never in the way

**User Story:** As a reader, I want the flower never to cover words or block a button.

#### Acceptance Criteria

1. WHEN the Target_Word is not on the first line of its Block, THE Sprout SHALL not be drawn, so that it never grows over a line of text.
2. THE Sprout SHALL take no pointer events, so that links and buttons under it still work.
3. THE Sprout SHALL be hidden from assistive technology (`aria-hidden="true"`) and SHALL take no focus.

### Requirement 6: Scope and the rules

**User Story:** As the owner, I want this exception to stay small, so that the rest of the radio look and the promises are untouched.

#### Acceptance Criteria

1. THE Sprout SHALL be loaded only by the Front_Page script, and THE Listen and Broadcast bundles SHALL contain no Sprout code.
2. THE `src/front/front.css` and `src/shared/ui/look.css` files SHALL contain no Sprout rule, and `tests/front/front-css.test.ts` SHALL pass unchanged.
3. THE Sprout SHALL add no dependency and SHALL make no network request (Promise 4).
4. WHEN this spec is done, `npm run typecheck`, `npm test` and `npm run build` with its offline check SHALL pass.
5. WHERE the Target_Word is in a headline, THE `src/front/sprout.css` file SHALL set `--sprout-height` for that headline's class in its "Placement on this site" part, between 3em and 4em.
