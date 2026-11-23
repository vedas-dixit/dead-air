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

**Under it:** Dead Air sends a short alert as sound. A nearby phone with the Listen page open can pick it up and show the message in the listener's language, even when there's no internet or mobile signal.

**Buttons:** Play test alert · Open Listen

**Next to the buttons:** a QR code that opens the Listen page, with the line "Scan with a second phone, then press Play test alert."

**Small line:** A prototype. A backup channel, not a replacement for official alerts.

---

## 2. The problem

**Section title:** When the network goes, it goes for everyone

Three big numbers:

| Number | Words under it | Source |
|---|---|---|
| 95.2% | of Puerto Rico's mobile sites were out of service after Hurricane Maria. | FCC, 2018: https://docs.fcc.gov/public/attachments/doc-353805a1.pdf |
| 29,000 | mobile base stations were out of service in Japan at the worst point after the 2011 earthquake and tsunami. | Japan MIC, 2011: https://www.soumu.go.jp/johotsusintokei/whitepaper/eng/WP2011/2011-outline.pdf |
| 24 hours | the length of the mobile, internet and broadband outage in Kashmir Valley after fibre cables were cut during heavy rain in August 2025. | Deccan Herald, 2025: https://www.deccanherald.com/amp/story/india%2Fjammu-and-kashmir%2Finternet-mobile-services-restored-in-jk-after-24-hour-disruption-amid-heavy-rains-3700035 |

**Line under the numbers:** Early warnings make a real difference. Countries with substantial or comprehensive warning systems recorded 6.1 times fewer disaster deaths than countries with limited or moderate systems.
Source: WMO and UNDRR, November 2026: https://wmo.int/news/media-centre/early-warning-protection-expands-worldwide

---

## 3. One storm, up close

Kiro: draw this as an alert card, in the same style as the cards on the Listen page, with the cyclone icon.

**Title:** Cyclone Fani

**Place and date:** Odisha, India · 3 May 2019

**What went down:** Telephone and mobile service across Puri district, along with power to about 3.5 million households.
Sources: Indian Red Cross, 2019: https://reliefweb.int/report/india/odisha-fani-cyclone-assessment-report · NASA, 2019: https://earthobservatory.nasa.gov/images/145017/lights-out-after-cyclone-fani

**What was still working:** Sirens from 122 coastal towers, along with volunteers and police radio.
Sources: UNDRR, 2019: https://www.undrr.org/news/fanis-hard-lesson-resilient-infrastructure · Hindustan Times, 13 May 2019: https://www.pressreader.com/india/hindustan-times-patiala/20190513/282020443740335

**What followed:** Around 1.2 million people were evacuated and 64 people died. The same coast was hit by a super cyclone in 1999; the official death toll was 9,885.
Sources: UNDRR, 2019 (same link) · World Bank, 2019: https://www.worldbank.org/en/news/speech/2019/06/14/odisha-fani-disaster-preparedness

**What was missing:** Even with those systems in place, people in some villages said they never received a warning about when the storm would arrive.
Source: Hindustan Times, 15 May 2019: https://www.pressreader.com/india/hindustan-times-st-jaipur/20190515/281938839366214

**Pictures:** `fani-before.webp` and `fani-after.webp`, side by side.
Caption: City lights around Bhubaneswar and Cuttack, before and after Cyclone Fani. Then the credit line from `docs/design/front/credits.md`.

**Line under the card:** People and sound helped carry the warning. Dead Air tries to add another way to receive it: a phone turns that sound into a message people can read or hear in their own language.

---

## 4. How it works

**Section title:** How a message gets through

1. **Send.** The sender chooses what happened, how urgent it is, what people should do and where. Dead Air packs those details into a message no longer than 40 bytes.
2. **Sound.** That message is turned into a short burst of sound. It can be played through a radio broadcast, a loudspeaker or another phone.
3. **Hear.** A nearby phone with Listen open picks up the sound through its microphone. It checks the message before showing anything, then displays the alert in English or Hindi. The phone can read it aloud, too. A listener can pass it on with one tap.

Kiro: if `docs/design/front/illustration-phone.webp` exists, show it in this section with the caption "Illustration". If it does not exist, show no picture here.

---

## 5. An old idea, brought back

**Section title:** This idea is older than the internet

**Text:** Computers used to send data through telephone lines as sound. Radio alert systems have used coded audio for years, too. Dead Air borrows from both.

Three points on a line:

- **1970s.** Acoustic couplers let computers exchange data through the sound travelling down a telephone handset.
  Picture: `acoustic-coupler.webp`, with the credit line from `docs/design/front/credits.md`.
- **1997.** In the United States, radio and TV emergency alerts use a short coded tone sequence that compatible receivers can recognise. The system is still in use.
  Source: US rules, 47 CFR 11.31: https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-11/subpart-B/section-11.31
- **2026.** Dead Air brings that basic idea to a web app on a phone.

**Pull quote:** "But the radio stayed on."
Sibyle Veil, head of Radio France, on the April 2025 blackout in Spain and Portugal, when power, mobile networks and the internet failed.
Source: EBU, 2025: https://www.ebu.ch/news/2025/09/when-everything-else-fails-radio-doesnt

---

## 6. Things we won't compromise on

1. If an alert fails its integrity check, we show none of it.
2. An expired alert is never presented as current. The time it was sent is always visible.
3. Test messages always carry a TEST label.
4. After the first visit, the app works offline. It doesn't contact third-party sites.
5. Audio from the microphone is processed in memory, then discarded. It is never recorded, saved or uploaded.
6. Every alert type has an icon and translated text in every language we support.

---

## 7. A few limits to be clear about

- This is a prototype. It has not been used in a real emergency.
- Dead Air is not a replacement for official alerts. India's SACHET system has sent over 134 billion SMS alerts in more than 19 languages. This is a backup idea for the times phones lose their network.
  Source: Government of India, PIB: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2140843&reg=48&lang=2
- The listener needs a smartphone with the Listen page open and the screen on. Visit the page once while you still have a connection so it can be saved for offline use.
- There also needs to be a working radio, loudspeaker or phone nearby to play the sound. Radio can stay on when mobile networks fail, but it isn't guaranteed to. Weeks after Hurricane Maria, about a third of Puerto Rico's AM and FM stations were still off air.
  Source: FCC, 2018: https://docs.fcc.gov/public/attachments/doc-353805a1.pdf
- Dead Air can't help if nobody sends a warning, or if it comes too late. The sirens in Maui were not sounded during the 2023 fires. In Valencia, the phone alert in 2024 went out after the flooding had started.
  Sources: NBC News, 2023: https://www.nbcnews.com/news/us-news/hawaiis-emergency-warning-sirens-werent-activated-alert-residents-agen-rcna99475 · Public Health Reviews, 2025: https://www.ssph-journal.org/journals/public-health-reviews/articles/10.3389/phrs.2025.1608297/full
- It can't currently verify the identity of whoever sent an alert.
- Right now, the app supports English and Hindi.
- A few informal tests so far: Kiro: take the tested distances from `docs/kiro-diary.md`. For radio and loudspeaker, give the result from the diary, or write "not tested yet".

---

## 8. Bottom

**Links:** Listen · Broadcast · GitHub (https://github.com/vedas-dixit/dead-air)

**Credits:** Kiro: name the font and the sound library with the licence each package states, then list the picture credits from `docs/design/front/credits.md`.

**Last line:** Dead Air is a prototype and a backup channel. Keep following official alerts.
