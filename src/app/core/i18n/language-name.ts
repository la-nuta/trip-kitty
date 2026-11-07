/** The language named in itself, so a new language needs no keys in other files. */
export function languageName(code: string): string {
  const name = new Intl.DisplayNames(code, { type: 'language' }).of(code) ?? code;
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}
