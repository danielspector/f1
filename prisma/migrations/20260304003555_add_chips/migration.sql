-- CreateEnum
CREATE TYPE "Chip" AS ENUM ('DOUBLE_POINTS', 'SAFETY_NET');

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "chipsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pick" ADD COLUMN     "chip" "Chip";
