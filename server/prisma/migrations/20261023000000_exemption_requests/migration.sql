ALTER TABLE "OfficeEntry" ADD COLUMN "forwardedToFinanceAt" TIMESTAMP(3);

CREATE TABLE "OfficeEntryAttachment" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfficeEntryAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OfficeEntryAttachment_entryId_idx" ON "OfficeEntryAttachment"("entryId");
ALTER TABLE "OfficeEntryAttachment" ADD CONSTRAINT "OfficeEntryAttachment_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "OfficeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
