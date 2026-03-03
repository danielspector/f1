-- AlterTable: Add email preferences columns with defaults
ALTER TABLE "User" ADD COLUMN "emailPickReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailRaceSummaries" BOOLEAN NOT NULL DEFAULT true;

-- Add unsubscribeToken as nullable first, then populate, then make required
ALTER TABLE "User" ADD COLUMN "unsubscribeToken" TEXT;

-- Populate existing rows with unique tokens using gen_random_uuid()
UPDATE "User" SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;

-- Now make it required and unique
ALTER TABLE "User" ALTER COLUMN "unsubscribeToken" SET NOT NULL;
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");
