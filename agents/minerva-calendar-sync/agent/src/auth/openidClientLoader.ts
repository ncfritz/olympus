/**
 * openid-client ships ESM-only; this project builds to CommonJS. A plain
 * `import()` expression looks like the right fix, but TypeScript downlevels
 * it to `Promise.resolve().then(() => require(...))` under CJS output,
 * which still throws ("Must use import to load ES Module") since it's a
 * real `require()` underneath. Constructing the import via `new Function`
 * hides it from that rewrite, forcing Node's own native dynamic import —
 * verified working against the actual installed package, not just in
 * theory. Every caller goes through here rather than importing the package
 * directly.
 */
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<typeof import("openid-client")>;

export function loadOpenIdClient(): Promise<typeof import("openid-client")> {
  return dynamicImport("openid-client");
}
