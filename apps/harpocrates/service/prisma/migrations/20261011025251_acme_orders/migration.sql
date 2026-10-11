-- CreateEnum
CREATE TYPE "AcmeOrderStatus" AS ENUM ('pending', 'ready', 'processing', 'valid', 'invalid');

-- CreateEnum
CREATE TYPE "AcmeAuthorizationStatus" AS ENUM ('pending', 'valid', 'invalid', 'deactivated', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "AcmeChallengeType" AS ENUM ('http-01', 'tls-alpn-01');

-- CreateEnum
CREATE TYPE "AcmeChallengeStatus" AS ENUM ('pending', 'processing', 'valid', 'invalid');

-- CreateTable
CREATE TABLE "acme_orders" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "status" "AcmeOrderStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "error_type" TEXT,
    "error_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_authorizations" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "status" "AcmeAuthorizationStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acme_challenges" (
    "id" UUID NOT NULL,
    "authorization_id" UUID NOT NULL,
    "type" "AcmeChallengeType" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "AcmeChallengeStatus" NOT NULL DEFAULT 'pending',
    "validated_at" TIMESTAMP(3),
    "error_type" TEXT,
    "error_detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acme_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acme_orders_account_id_created_at_idx" ON "acme_orders"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "acme_authorizations_order_id_identifier_key" ON "acme_authorizations"("order_id", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "acme_challenges_token_key" ON "acme_challenges"("token");

-- CreateIndex
CREATE UNIQUE INDEX "acme_challenges_authorization_id_type_key" ON "acme_challenges"("authorization_id", "type");

-- AddForeignKey
ALTER TABLE "acme_orders" ADD CONSTRAINT "acme_orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "acme_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acme_authorizations" ADD CONSTRAINT "acme_authorizations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "acme_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acme_challenges" ADD CONSTRAINT "acme_challenges_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "acme_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
