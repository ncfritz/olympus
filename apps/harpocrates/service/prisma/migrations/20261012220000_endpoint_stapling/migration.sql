-- Endpoint checks record OCSP stapling (ADR 0036): whether the endpoint
-- stapled a response, and whether the certificate it served requires one
-- (must-staple). Null when nothing answered.

-- AlterTable
ALTER TABLE "endpoint_observations" ADD COLUMN     "stapled" BOOLEAN,
ADD COLUMN     "served_must_staple" BOOLEAN;
