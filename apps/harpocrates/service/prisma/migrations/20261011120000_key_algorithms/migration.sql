-- The key types a certificate may have, chosen when it is issued (ADR 0020,
-- amended): a profile's is only the default.
ALTER TYPE "KeyAlgorithm" ADD VALUE 'RSA-3072';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'RSA-4096';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'RSA-8192';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'DSA-2048';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'DSA-3072';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'P-384';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'P-521';
ALTER TYPE "KeyAlgorithm" ADD VALUE 'Ed25519';
