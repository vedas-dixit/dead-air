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

- Orange is used only for: the TEST banner, the on-air lamp, the listening lamp, the TEST toggle lamp, the dial marker, the arrival flash band, the signal in the logo, and the one orange part allowed in an icon.
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
- Separation comes from panel colour and space, not from lines or depth. Lines appear only as marks: the 3 px ring of a hollow control (see State), an ink bar on the left of a field error and of the say-first line, and the ink ring round the TEST question.
- State, taken from the lamps: solid means live, hollow means idle. A lit lamp, a switch that is on and a button you can press are solid. An unlit lamp, a switch that is off and a locked control are hollow: a 3 px ring with the page colour inside. Buttons, fields and tiles carry a 3 px border in their own fill colour, so going hollow does not change their size.
- Focus: 3 px solid ring, ink in light and paper at night, with a 3 px gap.
- Selected tile: inverted in both themes. Light: ink fill, paper text and icon. Night: paper fill, ink text and icon. A round dot in the tile's corner also marks it, so selection never relies on colour alone.

## Type

- One bundled font for Latin letters and digits: IBM Plex Mono, weights 400 and 600 only, from the `@fontsource/ibm-plex-mono` package (dev dependency, approved; licence OFL-1.1, checked). The woff2 files are copied into the build and served from this site.
- At most 60 KB for all font files together, woff2, the package's unmodified Latin subset, using `unicode-range` so Hindi never falls into it.
- No font is loaded from another site. No font loader script. This is the only font family the languages spec's tests allow (see the edit to those tests below).
- Hindi uses the phone's own font (`system-ui` stack). The layout must hold in both languages: no fixed-height text boxes, no clipped lines, line height at least 1.5 for Hindi, and every screen checked in both.
- Headings and other tight lines use line height 1.25 in Latin and 1.6 in Hindi. Latin text inside a Hindi page (the "EN" button) keeps the bundled font.
- Small labels: capitals with wide spacing (0.12em). Where a language has no capitals (Hindi), turn off capitalisation and set letter spacing to 0, because spacing breaks joined Devanagari letters. Use `:lang(hi)`.
- Tile names and the words beside a switch are words to read, not small labels: no capitals and no letter spacing. Switch words are at body size. A long tile name wraps between words or hyphenates, never at any letter.
- Record the font's licence (name, SIL Open Font License 1.1, source package and version) in `README.md`. Ship the package's `LICENSE` text and copyright line next to the font files, because the licence requires every copy to carry them. Do not modify or rename the font.

## Size

- Large text. Body at least 1.125rem. Alert event name at least 2rem. Labels at least 0.875rem.
- All sizes in `rem` so they follow the phone's own text size setting. No `px` font sizes, no `user-scalable=no`, no text-size locks. The layout must still work at 200% text size.
- Touch targets at least 48 by 48 px with at least 8 px between neighbours. Tiles, switch positions, the language switch and every button follow this.
- One thumb: on a phone the primary controls of each page (Go on air and Stop on Broadcast, Start and Stop on Listen) sit in a bar at the bottom of the screen. Nothing important sits only in a top corner except the header switches, which stay within 48 px targets.
- Readable at arm's length: ink on paper at the sizes above, no light-weight type, no text under 0.875rem.

## Motion

- Motion only where it shows something real: sound arriving, a broadcast playing, a state change the user caused.
- Nothing that runs while listening may draw more than 15 times a second. The speaker grille updates at most 15 times a second, and a test checks the cap.
- The arrival flash stays within 3 flashes in any one second. It is a 24 px frame round the screen edge with two bands: an orange band and an ink band (paper band at night), so it shows in both themes.
- Under `prefers-reduced-motion: reduce`: no flash and no transitions or easing. The grille is a meter, not decoration, so it still shows the level, stepping at most twice a second with no easing. State otherwise shows by text, lamp and shape.
- No decorative animation, no loading spinners that loop, no animated backgrounds.

## Layout

- Phone first: one column, at most 40rem wide and centred. The header and the page share one 16 px gutter.
- From 60em wide, the Broadcast page, and the Listen page once it has a card, open into two columns up to 72rem wide, like the face of a hi-fi. See Broadcast layout and Listen layout below.
- The page headings (`h1`) of Listen and Broadcast are kept for screen readers and the page outline, but not drawn.
- The `hidden` attribute always wins over any display rule. An empty message area takes no room.

## Header, on every page

- Logo, then a two-position switch between Listen and Broadcast drawn as a slide switch (a pill track with a round knob and both labels in text), then the language switch. On a phone the switch takes the rest of the first row, up to 20rem, and the knob sits inside the track with a 4 px inset.
- The logo is `src/shared/ui/logo.svg`, one file. The people use `fill="currentColor"` (ink in light, paper at night). The signal stays `#FF5D1F` in every theme. `docs/design/logo-black.svg` and `logo-white.svg` are the source drawings and are not edited. The words "Dead Air" are not drawn in the header.
- The logo is inline SVG in the page HTML, `aria-hidden="true"`, 36 px tall and 55 px wide, and sits inside the link to the front page. The link also holds the words "Dead Air" as visually hidden text (`sr-only`), so screen readers and tests find the name. The logo is not a separate file in the saved-for-offline list. The front page has the same link.
- From 390 px wide up to 40em, the logo, the page switch and the language switch share one line. The page switch takes the rest of the row, and its floor is the width of its own words, so at a large text size the language switch drops to a second line and nothing overflows. Below 390 px the language switch may drop to a second line. Nothing is cut off at 360 px. Every button stays at least 48 px tall.
- The English button shows "EN" and its accessible name is "English". The Hindi button shows its own name. Padding inside the header pills is tighter on phones (0.25rem on the switch links, 0.25rem by 0.5rem on the language buttons).
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

- Broadcast event picker: a grid of nine tiles, each with icon and name, built as a group of radio buttons in a `fieldset` with a `legend`. Arrow keys move the choice, and screen readers announce name, position and state. Three tiles across, a bank of nine. It falls to two across, then one, when a third of the row is too narrow for a tile (a very small phone, or large text). While on air the picker is locked: the tiles not chosen go hollow and the chosen tile stays solid.
- Buttons: pills. Primary actions (Go on air, Start, and Cancel in the TEST question) are ink pills with paper text. Other buttons are panel pills. A button that cannot be pressed is hollow, with muted text on the page colour.
- Fields: panel fill, 12 px radius. Locked while on air they go hollow and the value stays easy to read. An invalid field gets an ink border, and its error sits under it with an ink bar on its left.
- Switches: every checkbox is drawn as a pill switch, 4.5rem by 48 px. Off is a hollow knob on the left, on is a solid knob on the right. The words sit beside it.
- TEST toggle: a clear switch with a text state ("TEST ON" / "TEST OFF") above its label, and an orange lamp at the open end of the track when on.
- Go on air: the largest control on the Broadcast page, a full-width pill at least 72 px high, with an orange on-air lamp while it plays and a text state. Its height is set in px so that at a large text size the bar does not take the screen away from the form. While sound plays it turns hollow and shows only the lamp and the on-air text, and Stop appears beside it as the solid pill. Stop is not drawn when there is nothing to stop.
- Broadcast layout: one form in two parts. The fields come first: the event tiles; urgency and severity; action and place name; the map point (latitude and longitude, then the location button); valid for and station ID. Paired fields sit side by side when each gets at least 15rem, otherwise one under the other. Then the deck: the TEST and repeat switches, the say-first line, the preview, Save, the status and repeat notes, and the bar. The bar is the last thing in the form and sticks to the bottom of the screen, so it sits over the form only until the user scrolls to it, and at the end of the page it covers nothing. Messages (the banner, the real-alert notice, the go note and the countdown) sit in the bar above the buttons. From 60em the fields are on the left and the deck on the right, up to 24rem wide. The deck stays in view while the form scrolls, scrolls inside itself on a short screen, and keeps the bar pinned to its foot.
- Say-first line: 1.25rem, bold, with a 6 px ink bar on its left that marks it as speech. Its block and heading are not drawn until there is a line.
- Preview: drawn as the card a listener gets, on the panel, with a small "draft" label pill. Not drawn until there is something to show.
- Banner and error line: the Broadcast banner, the real-alert notice and the Listen error line are ink panels with paper text, bold.
- TEST question: on a phone a bottom sheet, where the thumb is. From 40em it is centred. Paper with an ink ring, buttons stacked, over a panel-coloured backdrop.
- Listen meter: a round speaker grille made of dots that react to the live sound. It exposes `role="meter"` with a text value for screen readers, and stays a meter for them. It keeps working under reduced motion (see Motion).
- Listen layout: the receiver comes first. It holds the grille (14rem, at most 64 percent of the width) centred, the listening lamp and state line under it, then the unreadable, keep-open and history notes, then Start and Stop. Then the cards, newest first. Then the foot: the alert settings (flash and vibrate switches), Clear history, and the offline line and storage note in muted 0.875rem text. On a phone Start and Stop sit in a bar fixed to the bottom of the screen, buttons at least 56 px high, and the page leaves room so the bar never covers a card. From 60em the bar sits under the state line instead.
- Once an alert has arrived, the grille shrinks to 4rem and shares one row with the state line, so the top of the newest card is on screen without scrolling on a 360 by 640 px phone, at default text size: the TEST banner if there is one, the icon tile, the event name and the sentence line. Rows below may need a scroll. There is no "Details" fold. From 60em, once there is a card, the receiver and the foot sit in a left column up to 22rem wide, with the grille full size again, and the cards fill the right column.
- Alert card: a large icon tile, the event name in large type, then the rest. Sent time is always shown (promise 2). The rows are one column on a phone and two when the card is wide (each at least 17rem). The card's read-aloud button is an ink pill, because a panel pill would vanish on the panel.
- TEST banner (promise 3): a full-width orange bar, ink text, always the first thing in a test alert.
- Expired alert: the expired panel colour and a visible "no longer current" label. No strike-through anywhere on it. Sent time stays easy to read.
- Front page placeholder: same colours, type and shapes only. The header, then the name and two links inside `main`. It loads no app code and no other site's files.

## Interface files only

This file loads when interface files are open. It does not apply to the message code, the sound link or the offline worker logic.
