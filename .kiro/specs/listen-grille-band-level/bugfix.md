# Bugfix Requirements Document

## Introduction

The speaker grille on the Listen page is the level meter. It currently shows the peak sample of each audio block on a straight scale (`levelOf` in `src/listen/level.ts`). A short loud sound such as a knock on the table or a tap near the microphone has a high peak, so it lights the grille. A quiet broadcast from across the room has a low peak, so the grille barely moves. The grille therefore fails at its purpose: telling the listener whether the phone is hearing a broadcast.

The fix changes only what number the grille shows. It measures the average energy of a block inside the pitch range the sound link transmits in, on a decibel scale, and compares it with a running estimate of the room's background in that same range. The estimate falls quickly and rises slowly (about 20 seconds on the way up), so a broadcast does not drag the background up under itself. The range is taken from the sound link or the ggwave library, or measured with the dead-air-ears tools (`hear_wav`, `make_broadcast`, `round_trip`). It is not guessed. The decoding path, the 15 draws a second limit, the centre-outwards lighting, the reduced-motion rule and the meter role and text for screen readers do not change. This is display only.

Bug condition, in pseudocode:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AudioBlockSequence (blocks of microphone samples, with the room before them)
  OUTPUT: boolean

  // The grille level and the presence of the sound link signal disagree.
  RETURN (X contains a broadcast in the link's pitch range
            AND peak(X) is low
            AND levelOf(X) is near 0)
      OR (X contains a loud sound outside the link's pitch range
            AND NOT X contains a broadcast
            AND levelOf(X) is high)
END FUNCTION
```

Fix checking property:

```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result <- grilleLevel'(X)
  ASSERT (X contains a broadcast  => result lights more of the grille than any
                                     out-of-band sound of larger peak)
     AND (X is silence or steady room noise => result = 0)
END FOR
```

Preservation property:

```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT decode(X) = decode'(X)  AND  grille drawing behaviour is unchanged
END FOR
```

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a TEST broadcast arrives from across the room at a low volume THEN the system lights few or none of the grille dots, because the peak sample of each block is small.

1.2 WHEN a short loud sound outside the sound link's pitch range occurs (a knock on the table, a tap near the microphone, a low thump) THEN the system lights many grille dots, because the peak sample is large.

1.3 WHEN the room is silent or has steady background noise THEN the system shows a level that follows the raw peak of that noise instead of showing nothing, because the level is not compared with the room's background.

1.4 WHEN a signal's level is shown THEN the system maps it on a straight (linear) scale, so quiet signals occupy only the bottom of the range and are hard to tell apart from nothing.

### Expected Behavior (Correct)

2.1 WHEN a TEST broadcast arrives at a low level THEN the system SHALL light more of the grille than a much louder low-pitched thump does.

2.2 WHEN a short loud sound outside the sound link's pitch range occurs and no broadcast is present THEN the system SHALL NOT light the grille on account of that sound. The measurement SHALL cover only the pitch range the sound link transmits in. That range SHALL come from the sound link, the ggwave library, or a measurement with the ears tools, and SHALL NOT be guessed.

2.3 WHEN the room is silent or has steady background noise THEN the system SHALL light none of the grille. The level SHALL be the average energy of a block in the sound link's pitch range, in decibels, minus a running estimate of the room background in that same range, so the grille shows how far the signal band rises above the room. The background estimate SHALL track asymmetrically: it SHALL fall quickly when the band gets quieter, and it SHALL rise slowly, with a time constant of about 20 seconds on the way up. A single average of about 3 seconds SHALL NOT be used, because the background would climb under a broadcast that is still playing and the grille would fade out during it.

2.4 WHEN the level is computed THEN the system SHALL use average energy of the block, not its peak, and SHALL express it on a decibel scale. The measurement SHALL be a pure function (no browser APIs) built from a few Goertzel filters across the range, without an FFT library and without a new dependency.

2.5 WHEN a test is run against this fix THEN the system SHALL be checked with a real TEST broadcast made with the ears tools. A broadcast mixed at a low level SHALL light more of the grille than a much louder low-pitched thump, and silence or steady room noise SHALL light none. These tests SHALL use only TEST alerts, and no audio SHALL be stored by the tests beyond the existing ears tools output.

2.6 WHEN the fix is complete THEN `docs/kiro-diary.md` SHALL contain a diary line saying the change came from a real-room test.

2.7 WHEN a TEST broadcast is played twice, back to back, from a quiet room THEN the system SHALL keep the grille lit for the whole length of both plays, from the start of the first to the end of the second, and SHALL NOT let the background estimate rise far enough to fade it out. This SHALL be checked with a real TEST broadcast made with the ears tools, repeated twice with no gap, and it SHALL use only TEST alerts.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN any audio block is received THEN the system SHALL CONTINUE TO pass the same samples to the decoder in the same way, with no change to the decoding path, the check value handling, or which alerts are shown.

3.2 WHEN the level changes THEN the system SHALL CONTINUE TO light the grille dots from the centre outwards.

3.3 WHEN the level changes quickly THEN the system SHALL CONTINUE TO redraw the grille at most 15 times a second.

3.4 WHEN the user prefers reduced motion THEN the system SHALL CONTINUE TO follow the existing reduced-motion rule for the grille.

3.5 WHEN a screen reader reads the meter THEN the system SHALL CONTINUE TO expose the meter role and its text (`listen.level.label`), with the value taken from the new level.

3.6 WHEN the level is not running (idle, starting, stopped) THEN the system SHALL CONTINUE TO show a level of 0.

3.7 WHEN microphone audio is processed THEN the system SHALL CONTINUE TO keep it in memory only and discard it, and the app SHALL CONTINUE TO make no network request to any other site.

3.8 WHEN an empty block or a block with NaN samples is measured THEN the system SHALL CONTINUE TO return a safe level (0) without throwing.
