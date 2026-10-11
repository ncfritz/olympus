/*
 * What the shell imports besides code, as the consoles' Next builds (which
 * compile it from source, transpilePackages) and vitest hand it over.
 */

/** An image: Next's StaticImageData, or a URL under vitest. */
declare module "*.png" {
  const image: string | { src: string; width: number; height: number };
  export default image;
}

/** A CSS module's class names. */
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
