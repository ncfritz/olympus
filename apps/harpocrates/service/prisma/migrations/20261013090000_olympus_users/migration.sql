-- The Olympus users Harpocrates has seen: who `user:<id>` is, in the audit
-- log and wherever else a principal is recorded.

-- CreateTable
CREATE TABLE "olympus_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "olympus_users_pkey" PRIMARY KEY ("id")
);
