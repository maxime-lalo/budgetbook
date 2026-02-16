-- CreateTable
CREATE TABLE "app_preferences" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "amexEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_preferences_pkey" PRIMARY KEY ("id")
);
