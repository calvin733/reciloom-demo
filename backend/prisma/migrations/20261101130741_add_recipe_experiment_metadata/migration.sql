-- CreateEnum
CREATE TYPE "ExperimentTestStatus" AS ENUM ('NOT_TESTED', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "experiment_goal" TEXT,
ADD COLUMN     "experiment_result" TEXT,
ADD COLUMN     "experiment_status" "ExperimentTestStatus" NOT NULL DEFAULT 'NOT_TESTED';
