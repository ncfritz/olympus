/**
 * Known-weak RSA keys, refused whatever the profile (the CA/Browser
 * Forum's Baseline Requirements, 6.1.1.3, item 5): ROCA and close primes.
 * EC keys have neither weakness; the Debian blocklists are not carried
 * (the signer generates its keys, and CSR keys from Debian's 2008 OpenSSL
 * are long gone from this network).
 */

/** Primes of the ROCA fingerprint (Nemec et al., CCS 2017). */
const ROCA_PRIMES = [
  3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73,
  79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157,
  163, 167,
];

/** For each prime, the residues 65537^k mod p: the subgroup ROCA keys fall in. */
const ROCA_SUBGROUPS = ROCA_PRIMES.map((p) => {
  const residues = new Set<number>();
  let value = 1;
  do {
    residues.add(value);
    value = (value * (65537 % p)) % p;
  } while (value !== 1);
  return { p: BigInt(p), residues };
});

/** A modulus whose residues all fall in 65537's subgroups is a ROCA key. */
export const isRocaVulnerable = (modulus: bigint): boolean =>
  ROCA_SUBGROUPS.every(({ p, residues }) => residues.has(Number(modulus % p)));

/** The integer square root, by Newton's method from above. */
const isqrt = (n: bigint): bigint => {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
};

/**
 * Fermat's method for `rounds` steps: a modulus whose primes are close
 * together factors almost at once. The BR requires 100 rounds.
 */
export const hasClosePrimes = (modulus: bigint, rounds = 100): boolean => {
  let a = isqrt(modulus);
  if (a * a < modulus) a += 1n;
  for (let i = 0; i < rounds; i += 1, a += 1n) {
    const b2 = a * a - modulus;
    const b = isqrt(b2);
    if (b * b === b2) return true;
  }
  return false;
};

/** Why a modulus is weak, or undefined. */
export const weakness = (modulus: bigint | undefined): string | undefined => {
  if (modulus === undefined) return undefined;
  if (isRocaVulnerable(modulus)) return "the key is vulnerable to ROCA";
  if (hasClosePrimes(modulus)) return "the key's primes are too close together";
  return undefined;
};
