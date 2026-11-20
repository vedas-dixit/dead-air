// Type helpers for language files. Types only, no runtime code.

/**
 * Resolves to `true` when A and B have exactly the same keys, otherwise `false`.
 * Use as `const _ok: SameKeys<A, B> = true;` to get a compile error on drift.
 */
export type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;

/**
 * The placeholder names in a template type, as a union.
 * `Placeholders<'Sent at {time} in {place}'>` is `'time' | 'place'`.
 */
export type Placeholders<T extends string> =
  T extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;
