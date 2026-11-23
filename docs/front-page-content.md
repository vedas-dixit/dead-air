# Front page content

This file holds the words, facts and order for the front page at `/`.

Notes for Kiro:

- Use these words and facts as written. Do not add facts, numbers or claims that are not in this file.
- Every number keeps its source link next to it, as a small ordinary link.
- Lines that start with "Kiro:" are instructions, not page text.
- Hindi goes through the usual translation check.

---

## 1. Top

**Headline:** When the internet dies, the radio still speaks.

**Under it:** Dead Air turns an emergency alert into a few seconds of sound. Any phone with this page open hears it and shows the alert in the reader's own language, with no network.

**Buttons:** Play test alert · Open Listen

**Next to the buttons:** a QR code that opens the Listen page, with the line "Scan with a second phone, then press Play test alert."

**Small line:** A prototype. A backup channel, not a replacement for official alerts.

---

## 2. The problem

**Section title:** Networks fail when people need them most

Three big numbers:

| Number | Words under it | Source |
|---|---|---|
| 95.2% | of Puerto Rico's cell sites were out of service after Hurricane Maria. | FCC, 2018: https://docs.fcc.gov/public/attachments/doc-353805a1.pdf |
| 29,000 | mobile base stations, at the worst point, stopped working in Japan after the 2011 earthquake and tsunami. | Japan MIC, 2011: https://www.soumu.go.jp/johotsusintokei/whitepaper/eng/WP2011/2011-outline.pdf |
| 24 hours | is about how long the Kashmir Valley went without mobile, internet and broadband after fibre cuts in heavy rain, August 2025. | Deccan Herald, 2025: https://www.deccanherald.com/amp/story/india%2Fjammu-and-kashmir%2Finternet-mobile-services-restored-in-jk-after-24-hour-disruption-amid-heavy-rains-3700035 |

**Line under the numbers:** Warnings that reach people save lives. Countries with substantial to comprehensive early warning systems recorded disaster deaths 6.1 times lower than countries with limited to moderate ones.
Source: WMO and UNDRR, November 2026: https://wmo.int/news/media-centre/early-warning-protection-expands-worldwide

---

## 3. One storm, up close

Kiro: draw this as an alert card, in the same style as the cards on the Listen page, with the cyclone icon.

**Title:** Cyclone Fani

**Place and date:** Odisha, India · 3 May 2019

**What failed:** Every telephone and cell phone in Puri district. Power to about 3.5 million households.
Sources: Indian Red Cross, 2019: https://reliefweb.int/report/india/odisha-fani-cyclone-assessment-report · NASA, 2019: https://earthobservatory.nasa.gov/images/145017/lights-out-after-cyclone-fani

**What still worked:** Sirens from 122 towers on the coast, volunteers, and police radio.
Sources: UNDRR, 2019: https://www.undrr.org/news/fanis-hard-lesson-resilient-infrastructure · Hindustan Times, 13 May 2019: https://www.pressreader.com/india/hindustan-times-patiala/20190513/282020443740335

**What happened:** 1.2 million people were evacuated. 64 people died. A super cyclone on the same coast in 1999 killed 9,885 by the official count.
Sources: UNDRR, 2019 (same link) · World Bank, 2019: https://www.worldbank.org/en/news/speech/2019/06/14/odisha-fani-disaster-preparedness

**The gap:** Even then, people in some villages said no message reached them about when the storm would land.
Source: Hindustan Times, 15 May 2019: https://www.pressreader.com/india/hindustan-times-st-jaipur/20190515/281938839366214

**Pictures:** `fani-before.webp` and `fani-after.webp`, side by side.
Caption: City lights around Bhubaneswar and Cuttack, before and after Cyclone Fani. Then the credit line from `docs/design/front/credits.md`.

**Line under the card:** Sound and people carried that warning. Dead Air adds one small thing: the sound becomes text, an icon and a voice on the phone, in the listener's own language.

---

## 4. How it works

**Section title:** How it works

1. **Send.** Someone picks an alert: what happened, how urgent it is, what to do, and where. Dead Air packs it into 40 bytes or less.
2. **Sound.** The alert becomes a few seconds of sound, like an old modem. It is made to be played over a radio broadcast or a loudspeaker, or straight from a phone.
3. **Hear.** Any phone with the Listen page open hears it through the microphone and checks it. It shows the alert with an icon, in English or Hindi, and can read it aloud. One tap passes it on to the next phone.

Kiro: if `docs/design/front/illustration-phone.webp` exists, show it in this section with the caption "Illustration". If it does not exist, show no picture here.

---

## 5. An old idea, brought back

**Section title:** An old idea, brought back

**Text:** Sending data as sound is not new. It is how computers first went online, and how radio alerts have worked for decades.

Three points on a line:

- **1970s.** Acoustic couplers. A computer talks through a telephone handset, by sound.
  Picture: `acoustic-coupler.webp`, with the credit line from `docs/design/front/credits.md`.
- **1997.** In the United States, radio and TV alerts start with a short burst of coded sound that a receiver can read. It is still in use.
  Source: US rules, 47 CFR 11.31: https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-11/subpart-B/section-11.31
- **2026.** Dead Air does the same in a web page, on a smartphone.

**Pull quote:** "But the radio stayed on."
Sibyle Veil, head of Radio France, on the April 2025 blackout in Spain and Portugal, when power, mobile networks and the internet failed.
Source: EBU, 2025: https://www.ebu.ch/news/2025/09/when-everything-else-fails-radio-doesnt

---

## 6. What we promise

1. A damaged alert is never shown.
2. An expired alert is never shown as current. Every alert shows when it was sent.
3. A test is always marked TEST.
4. After the first load, it works with no network and never contacts any other site.
5. Microphone sound is never recorded, stored or uploaded.
6. Every alert has an icon and text in every language the app ships.

---

## 7. What it is not

- It is a prototype. It has never been used in a real disaster.
- It does not replace official alerts. India's SACHET system has sent over 134 billion SMS alerts in more than 19 languages. Dead Air is a backup for when phones lose the network.
  Source: Government of India, PIB: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2140843&reg=48&lang=2
- It needs a smartphone with the Listen page open and the screen on. Load the page once while you still have a connection.
- It needs a working radio, loudspeaker or phone nearby. Radio often outlasts mobile networks, but not always. Weeks after Hurricane Maria, about one-third of Puerto Rico's AM and FM stations were still off air.
  Source: FCC, 2018: https://docs.fcc.gov/public/attachments/doc-353805a1.pdf
- It cannot help when no warning is sent, or when it is sent too late. In Maui in 2023 the sirens were never sounded. In Valencia in 2024 the phone alert went out after the flooding had begun.
  Sources: NBC News, 2023: https://www.nbcnews.com/news/us-news/hawaiis-emergency-warning-sirens-werent-activated-alert-residents-agen-rcna99475 · Public Health Reviews, 2025: https://www.ssph-journal.org/journals/public-health-reviews/articles/10.3389/phrs.2025.1608297/full
- It cannot yet prove who sent an alert.
- English and Hindi so far.
- Tested so far: Kiro: take the tested distances from `docs/kiro-diary.md`. For radio and loudspeaker, give the result from the diary, or write "not tested yet".

---

## 8. Bottom

**Links:** Listen · Broadcast · GitHub (https://github.com/vedas-dixit/dead-air)

**Credits:** Kiro: name the font and the sound library with the licence each package states, then list the picture credits from `docs/design/front/credits.md`.

**Last line:** Dead Air is a prototype and a backup channel. Always follow official alerts.
