-- CreateEnum
CREATE TYPE "AcmeNameKind" AS ENUM ('exact', 'subtree');

-- CreateEnum
CREATE TYPE "AcmeAccountStatus" AS ENUM ('valid', 'deactivated', 'revoked');

-- CreateTable
CREATE TABLE "acme_eab_credentials" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hmac_key" TEXT,
    "principal" TEXT NOT NULL,
    "bound_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_eab_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_name_policies" (
    "id" SERIAL NOT NULL,
    "credential_id" TEXT NOT NULL,
    "kind" "AcmeNameKind" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_name_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_accounts" (
    "id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "key_thumbprint" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "status" "AcmeAccountStatus" NOT NULL DEFAULT 'valid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_account_contacts" (
    "id" SERIAL NOT NULL,
    "account_id" UUID NOT NULL,
    "uri" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_account_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_nonces" (
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_nonces_pkey" PRIMARY KEY ("value")
);

-- CreateIndex
CREATE UNIQUE INDEX "acme_name_policies_credential_id_kind_value_key" ON "acme_name_policies"("credential_id", "kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "acme_accounts_credential_id_key" ON "acme_accounts"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "acme_accounts_key_thumbprint_key" ON "acme_accounts"("key_thumbprint");

-- CreateIndex
CREATE UNIQUE INDEX "acme_account_contacts_account_id_uri_key" ON "acme_account_contacts"("account_id", "uri");

-- CreateIndex
CREATE INDEX "acme_nonces_expires_at_idx" ON "acme_nonces"("expires_at");

-- AddForeignKey
ALTER TABLE "acme_name_policies" ADD CONSTRAINT "acme_name_policies_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "acme_eab_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acme_accounts" ADD CONSTRAINT "acme_accounts_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "acme_eab_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acme_account_contacts" ADD CONSTRAINT "acme_account_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "acme_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
