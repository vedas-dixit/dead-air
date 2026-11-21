/** Primary language subtag of a BCP 47 style tag, lower case. Accepts `-` or `_` as separator. */
export function primarySubtag(tag: string): string {
  return tag.split(/[-_]/)[0].trim().toLowerCase();
}

/** True when both tags have a non-empty primary subtag and the subtags are equal. */
export function sameLanguage(a: string, b: string): boolean {
  const pa = primarySubtag(a);
  const pb = primarySubtag(b);
  return pa !== '' && pa === pb;
}
