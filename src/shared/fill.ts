// Fills `{name}` placeholders in a template. No DOM, no browser API.

export type TemplateParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/**
 * Returns the template with every `{name}` replaced by its parameter.
 * Returns null when the template is missing or empty, or when a placeholder
 * has no parameter. Extra parameters are ignored.
 */
export function fillTemplate(
  template: string | null | undefined,
  params: TemplateParams = {},
): string | null {
  if (typeof template !== 'string' || template.length === 0) return null;
  let missing = false;
  const out = template.replace(PLACEHOLDER, (_whole, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      missing = true;
      return '';
    }
    const value = params[name];
    if (typeof value !== 'string' && typeof value !== 'number') {
      missing = true;
      return '';
    }
    return String(value);
  });
  return missing ? null : out;
}
