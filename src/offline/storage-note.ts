// Storage_Note rules. Pure: the caller passes in what it read from the browser.
export interface NoteInput {
  firstPress: boolean;
  persisted: boolean;
  homeScreen: boolean;
}

/** Visible only after a press, when persistence was refused and the page is not on the Home Screen. */
export function storageNoteVisible(i: NoteInput): boolean {
  return i.firstPress && !i.persisted && !i.homeScreen;
}

/** True when either the display-mode media query or navigator.standalone says standalone. */
export function isHomeScreenMode(m: {
  displayStandalone: boolean;
  navigatorStandalone: boolean | undefined;
}): boolean {
  return m.displayStandalone === true || m.navigatorStandalone === true;
}
