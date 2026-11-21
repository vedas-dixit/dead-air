---
inclusion: fileMatch
fileMatchPattern: ["**/*.css", "**/*.html", "**/dom/**", "**/icons/**/*.svg", "src/shared/ui/**"]
---

# Style rules: the radio look

The face of a mid-century radio or hi-fi. Plain geometry, calm space, nothing decorative. `docs/design/mockup.png` shows the general arrangement only. Where it and these rules disagree, these rules win. This look replaces the earlier "Teletext look".

These rules never override `promises.md`. Look changes must not change what a page does.

## Colour

| Name | Light theme | Night theme | Use |
|---|---|---|---|
| Paper | #EAE4D9 | text colour | Light page. Night text. |
| Ink | #111111 | page | Light text and shapes. Night page. |
| Panel | #C6BEAC | #26231F | Tiles, fields, cards |
| Panel, expired | #DDD6C8 | #1B1916 | Alert cards that are no longer current |
| Selected tile | Ink fill, paper text and icon | Paper fill, ink text and icon | Chosen tile in a picker. Inverted in both themes. |
| Signal orange | #FF5D1F | #FF5D1F | Live or needs attention only (see below) |
| Olive | #5B6E53 | #8FA586 | "All clear" mark only |
| Muted | #6B6558 | #B9B2A2 | Secondary text on the page background only |

- Orange is used only for: the TEST banner, the on-air lamp, the listening lamp, the TEST toggle lamp, the dial marker, the arrival flash band, and the one orange part allowed in an icon.
- Orange never carries meaning alone. Every lamp has a 3 px ring (ink in light, paper at night) and sits beside a text state. The orange part of an icon is an accent: the icon reads from its ink shape without it.
- Orange is never a text colour, on any background. Text on orange is ink.
- Olive is a shape (dot or ring), never text, and sits on paper (light) or ink and dark panel (night). It is not used on the light panel, where it fails 3:1.
- Muted text is never placed on a panel.
- The night theme uses the same shapes, sizes and layout. It follows `prefers-color-scheme: dark`. There is no manual theme toggle. Colours are CSS custom properties set once per theme, so no component names a hex value.

### Contrast ratios (WCAG 2.x, measured)

Text and shape pairs, light theme:

| Foreground | Background | Ratio | Use | Passes |
|---|---|---|---|---|
| Ink #111111 | Paper #EAE4D9 | 14.92 | Body text | AA, AAA |
| Ink #111111 | Panel #C6BEAC | 10.22 | Text on tiles and fields | AA, AAA |
| Ink #111111 | Orange #FF5D1F | 6.15 | TEST banner text | AA |
| Ink #111111 | Expired panel #DDD6C8 | 13.06 | Text on expired cards | AA, AAA |
| Paper #EAE4D9 | Ink #111111 | 14.92 | Selected tile text and icon | AA, AAA |
| Orange #FF5D1F | Ink #111111 | 6.15 | Orange icon part on a selected tile (accent) | Shape OK |
| Orange #FF5D1F | Panel #C6BEAC | 1.66 | Orange icon part on an unselected tile (accent only) | Fails by design |
| Muted #6B6558 | Paper #EAE4D9 | 4.58 | Secondary text | AA |
| Olive #5B6E53 | Paper #EAE4D9 | 4.37 | All-clear mark (shape, needs 3:1) | Shape only |
| Paper #EAE4D9 | Olive #5B6E53 | 4.37 | Not used for text | Shape only |
| Orange #FF5D1F | Paper #EAE4D9 | 2.43 | Never used as text. Lamp beside ink text only. | Fails by design |
| Muted #6B6558 | Panel #C6BEAC | 3.13 | Forbidden pair | Fails by design |
| Muted #6B6558 | Expired panel #DDD6C8 | 4.00 | Forbidden pair. Expired cards use ink text only. | Fails by design |
| Olive #5B6E53 | Panel #C6BEAC | 2.99 | Forbidden pair | Fails by design |

Text and shape pairs, night theme:

| Foreground | Background | Ratio | Use | Passes |
|---|---|---|---|---|
| Paper #EAE4D9 | Ink #111111 | 14.92 | Body text | AA, AAA |
| Paper #EAE4D9 | Panel #26231F | 12.36 | Text on tiles and fields | AA, AAA |
| Paper #EAE4D9 | Expired panel #1B1916 | 13.86 | Text on expired cards | AA, AAA |
| Muted #B9B2A2 | Expired panel #1B1916 | 8.31 | Secondary text on expired cards | AA, AAA |
| Ink #111111 | Paper #EAE4D9 | 14.92 | Selected tile text and icon | AA, AAA |
| Orange #FF5D1F | Paper #EAE4D9 | 2.43 | Orange icon part on a selected tile (accent only) | Fails by design |
| Orange #FF5D1F | Panel #26231F | 5.09 | Orange icon part on an unselected tile | Shape OK |
| Ink #111111 | Orange #FF5D1F | 6.15 | TEST banner text | AA |
| Muted #B9B2A2 | Ink #111111 | 8.95 | Secondary text | AA, AAA |
| Muted #B9B2A2 | Panel #26231F | 7.41 | Secondary text on panels | AA, AAA |
| Olive #8FA586 | Ink #111111 | 7.10 | All-clear mark (shape) | Shape OK |
| Olive #8FA586 | Panel #26231F | 5.88 | All-clear mark on a panel (shape) | Shape OK |
| Orange #FF5D1F | Ink #111111 | 6.15 | Lamps and marker (shape, needs 3:1) | Shape OK |
| Orange #FF5D1F | Panel #26231F | 5.09 | Lamps on panels (shape) | Shape OK |

- Text needs 4.5:1, or 3:1 for text at 24 px and above. Shapes that carry meaning need 3:1.
- A theme test computes every pair in this table from the shipped CSS values and fails if one drops below its limit.
- Expired alerts: the card uses the expired panel colour, a visible "no longer current" label, and ink (paper at night) text at full contrast. Nothing on it is struck through, and the sent time stays plain and easy to read. Muted text is allowed on the expired panel at night only.
- The panel colours are close to each other and to the page, so a card's state is never told by panel colour alone. The label and the selected-tile dot (see Shape) carry it too.

## Shape

- Allowed: circles, dots, straight bars, rounded rectangles.
- One corner radius for every tile, card, field and panel: 12 px.
- Buttons and switches are full pills (radius 999 px). The TEST banner is a straight bar with no radius.
- Forbidden: shadows, gradients, glows, blur, outlines that fake a glow, textures, images used as decoration.
- Separation comes from panel colour and space, not from lines or depth.
- Focus: 3 px solid ring, ink in light and paper at night, with a 3 px gap.
- Selected tile: inverted in both themes. Light: ink fill, paper text and icon. Night: paper fill, ink text and icon. A round dot in the tile's corner also marks it, so selection never relies on colour alone.

## Type

- One bundled font for Latin letters and digits: IBM Plex Mono, weights 400 and 600 only, from the `@fontsource/ibm-plex-mono` package (dev dependency, approved; licence OFL-1.1, checked). The woff2 files are copied into the build and served from this site.
- At most 60 KB for all font files together, woff2, the package's unmodified Latin subset, using `unicode-range` so Hindi never falls into it.
- No font is loaded from another site. No font loader script. This is the only font family the languages spec's tests allow (see the edit to those tests below).
- Hindi uses the phone's own font (`system-ui` stack). The layout must hold in both languages: no fixed-height text boxes, no clipped lines, line height at least 1.5 for Hindi, and every screen checked in both.
- Small labels: capitals with wide spacing (0.12em). Where a language has no capitals (Hindi), turn off capitalisation and set letter spacing to 0, because spacing breaks joined Devanagari letters. Use `:lang(hi)`.
- Record the font's licence (name, SIL Open Font License 1.1, source package and version) in `README.md`. Ship the package's `LICENSE` text and copyright line next to the font files, because the licence requires every copy to carry them. Do not modify or rename the font.

## Size

- Large text. Body at least 1.125rem. Alert event name at least 2rem. Labels at least 0.875rem.
- All sizes in `rem` so they follow the phone's own text size setting. No `px` font sizes, no `user-scalable=no`, no text-size locks. The layout must still work at 200% text size.
- Touch targets at least 48 by 48 px with at least 8 px between neighbours. Tiles, switch positions, the language switch and every button follow this.
- One thumb: the primary control of each page (Go on air, listening lamp and start button) sits in the lower half of the screen on a phone. Nothing important sits only in a top corner except the header switches, which stay within 48 px targets.
- Readable at arm's length: ink on paper at the sizes above, no light-weight type, no text under 0.875rem.

## Motion

- Motion only where it shows something real: sound arriving, a broadcast playing, a state change the user caused.
- Nothing that runs while listening may draw more than 15 times a second. The speaker grille updates at most 15 times a second, and a test checks the cap.
- The arrival flash stays within 3 flashes in any one second. It is a 24 px frame round the screen edge with two bands: an orange band and an ink band (paper band at night), so it shows in both themes.
- Under `prefers-reduced-motion: reduce`: no flash and no transitions or easing. The grille is a meter, not decoration, so it still shows the level, stepping at most twice a second with no easing. State otherwise shows by text, lamp and shape.
- No decorative animation, no loading spinners that loop, no animated backgrounds.

## Header, on every page

- Name, then a two-position switch between Listen and Broadcast drawn as a slide switch (a pill track with a round knob and both labels in text), then the language switch.
- The current page is shown by knob position and by text, never by colour alone.
- The switch is a pair of real links to `/listen` and `/broadcast`. It works without scripts and keyboard use works.

## Icons

- Nine event types, nine SVG files in `src/shared/ui/icons/`, one file each, so a drawing can be swapped without code changes.
- Same simple shapes as above. The main shapes use `fill="currentColor"`, so an icon is ink in light, paper at night, and flips on a selected tile with its text. Cut-outs are real holes in the path (`fill-rule="evenodd"`), not white paint, so the panel shows through.
- At most one orange part, which stays `#FF5D1F` in every theme and state. No gradients, no strokes thinner than 2 px at 32 px.
- 48 by 48 `viewBox`, drawn so each one is distinct at 32 px.
- Always next to the event's name as visible text, never instead of it. The SVG is decorative (`aria-hidden="true"`) because the name is the label.
- Inlined or bundled at build time, so `currentColor` follows the page theme. No icon is fetched from another site (promise 4). A test checks that all nine exist and are in the offline file list (promise 6).

| Event | Idea |
|---|---|
| Flood | Level lines with one wave |
| Cyclone | Rings around a dot |
| Fire | A flame made from a circle and a point |
| Earthquake | A line broken by a zigzag |
| Heatwave | A solid circle with short bars round it |
| Landslide | A slanted block with falling dots |
| Medical | A plus made of two bars |
| Missing person | Outlined head and shoulders with a gap |
| All clear | A ring with a check |

## Components

- Broadcast event picker: a grid of nine tiles, each with icon and name, built as a group of radio buttons in a `fieldset` with a `legend`. Arrow keys move the choice, and screen readers announce name, position and state.
- TEST toggle: a clear switch with a text state ("TEST ON" / "TEST OFF") and an orange lamp when on.
- Go on air: the largest control on the Broadcast page, a full-width pill, with an orange on-air lamp while it plays and a text state.
- Listen meter: a round speaker grille made of dots that react to the live sound. It exposes `role="meter"` with a text value for screen readers, and stays a meter for them. It keeps working under reduced motion (see Motion).
- Listen layout: once an alert has arrived, the top of the newest card is on screen without scrolling on a 360 by 640 px phone, at default text size: the TEST banner if there is one, the icon tile, the event name and the sentence line. Rows below may need a scroll. The grille shrinks to a compact strip to make room. There is no "Details" fold. Start and Stop may sit in a bar fixed to the bottom of the screen, within thumb reach, and the page leaves room so the bar never covers a card.
- Alert card: a large icon tile, the event name in large type, then the rest. Sent time is always shown (promise 2).
- TEST banner (promise 3): a full-width orange bar, ink text, always the first thing in a test alert.
- Expired alert: the expired panel colour and a visible "no longer current" label. No strike-through anywhere on it. Sent time stays easy to read.
- Front page placeholder: same colours, type and shapes only. It loads no app code and no other site's files.

## Interface files only

This file loads when interface files are open. It does not apply to the message code, the sound link or the offline worker logic.
