-- OCSP in certificates (ADR 0036): each CA's OCSP URL, and whether a
-- version puts it in its certificates and asks for must-staple. Existing
-- CAs answer at their distribution host's /ocsp, the host their list is
-- published on.

-- AlterTable
ALTER TABLE "issuers" ADD COLUMN     "ocsp_url" TEXT;

UPDATE "issuers" SET "ocsp_url" = regexp_replace("crl_url", '/crl/[^/]*$', '/ocsp');

ALTER TABLE "issuers" ALTER COLUMN "ocsp_url" SET NOT NULL;

-- AlterTable
ALTER TABLE "profile_versions" ADD COLUMN     "include_ocsp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "must_staple" BOOLEAN NOT NULL DEFAULT false;
