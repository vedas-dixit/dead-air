# Implementation Plan: Front Page Sprout

## Overview

Copy, do not rewrite. The code and tests are finished in `docs/design/sprout/kit/` and were run against this repository before hand-over. Read `docs/design/sprout/guide.md` once before task 1. Every command runs from the project root. Do not change any file in the Kit, and do not edit the copied files except where a task says so.

## Tasks

- [x] 1. Confirm the Target_Word
  - [x] 1.1 Record the target in `design.md`
    - The Target_Word is the word the owner named when starting this spec. If no word was named, stop and ask. Do not choose one.
    - Find it in `index.html`. Fill in the "Target" table at the top of `design.md`: the word, the Chosen_Letter, its element, its Block and the Block's class.
    - Check the four points of the Guide, Step 1. Write in the table whether the word starts the first line of its Block at 360, 390, 768 and 1280 px wide (reason from the CSS, or ask the owner). If the word shares a `data-text` element with other words, stop and ask the owner: the text has to be split into its own key first, which is outside this spec.
    - _Requirements: 1.3, 1.4, 5.1_

- [x] 2. Copy the Kit into the source
  - [x] 2.1 Copy the four source files
    - Run:
      `cp docs/design/sprout/kit/sprout-drawing.ts docs/design/sprout/kit/sprout-ink.ts docs/design/sprout/kit/sprout.css src/front/`
      `cp docs/design/sprout/kit/dom/sprout.ts src/front/dom/`
    - Do not change their imports. Do not edit `sprout-drawing.ts`.
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.3, 6.3_
  - [x] 2.2 Copy the four test files
    - Run: `cp docs/design/sprout/kit/tests/*.ts tests/front/`
    - Run `npx vitest run tests/front/sprout-ink tests/front/sprout-drawing tests/front/sprout-css` and check they pass. (`sprout-markup.test.ts` passes after tasks 3 and 4.)
    - _Requirements: 2.1, 2.2, 2.5, 3.3, 4.1, 4.2, 5.2, 6.2_

- [x] 3. Put the Anchor in `index.html`
  - [x] 3.1 Wrap the Target_Word
    - Use the markup of the Guide, Step 3, exactly, on one line:
      `<span class="sprout-host"><span class="sprout" data-sprout aria-hidden="true"></span>WORD</span>`
    - If the Target_Word is its own element, WORD is that whole element, unchanged (same `id`, same `data-text`, same text).
    - If the Target_Word is plain text in an element without `data-text`, WORD is the word and any punctuation stuck to it.
    - If the owner asked for a letter other than the first, add ` data-sprout-letter="N"` straight after `data-sprout`.
    - Change nothing else in `index.html`.
    - _Requirements: 1.3, 1.4, 1.5, 5.3_

- [x] 4. Wire it in `src/front/main.ts`
  - [x] 4.1 Add three lines
    - `import './sprout.css';` straight after `import './front.css';`
    - `import { mountSprouts } from './dom/sprout';` with the other `./dom/` imports
    - `mountSprouts(document);` straight after `mountHowScene(document);`
    - Do not link `sprout.css` from `index.html`.
    - _Requirements: 4.3, 6.1_

- [x] 5. Size it
  - [x] 5.1 Set the plant height for a headline
    - If the Block is a heading, add one rule to the "Placement on this site" part at the end of `src/front/sprout.css`, on the Block's class: `--sprout-height: 3.5em;` (between 3em and 4em). For example `.hero-title { --sprout-height: 3.5em; }`.
    - For body text, add nothing.
    - Never put a sprout rule in `front.css` or `look.css`.
    - Record the value in the "Target" table of `design.md`.
    - _Requirements: 2.2, 6.2, 6.5_

- [x] 6. Checkpoint: all checks pass
  - Run `npm run typecheck`, `npm test` and `npm run build`. All must pass, including the offline check at the end of the build.
  - Run `grep -l sprout dist/assets/*.js`. It must list only the front page bundle (`main-*.js`).
  - If a test fails, read the Guide, "When it goes wrong", before changing anything. Fix the markup or the wiring, never the Kit code or its tests.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 7. Diary
  - [x] 7.1 Add an entry to `docs/kiro-diary.md`
    - Heading: `## Spec 11: Front page sprout (<date>)`. Same style as the entries above it: the files, the Target_Word, the decisions (the style-rules exception, the separate `sprout.css`, the anchor outside `data-text`, the 1 px probe, first line only), and the check results with their numbers.
    - _Requirements: 6.4_

- [ ] 8. Owner's check in a real browser
  - The owner goes through the list in the Guide, Step 7: root on the letter in English and Hindi, growth and regrowth, both themes, 360 to 1280 px, reduced motion, 200 percent text, clicks near the plant.
  - _Requirements: 2.1, 2.3, 3.1, 3.2, 4.1, 5.1, 5.2_

## Notes

- Every test task is required. No task is optional.
- Front-page spec files touched, with the owner's approval: `index.html` (one Host and Anchor) and `src/front/main.ts` (three lines). Nothing in `src/broadcast/`, `src/listen/`, `src/offline/` or `src/shared/` changes.
- To try a word before changing the page, run `npx vite` and open `/docs/design/sprout/preview.html`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["7.1", "8"] }
  ]
}
```
