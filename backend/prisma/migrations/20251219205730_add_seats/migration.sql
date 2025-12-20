/*
  Warnings:

  - You are about to alter the column `averageUnitCost` on the `StockItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.
  - You are about to alter the column `unitCostSnapshot` on the `StockMovement` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(10,4)`.

*/
-- AlterTable
ALTER TABLE "StockItem" ALTER COLUMN "averageUnitCost" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "unitCostSnapshot" SET DATA TYPE DECIMAL(10,4);

-- CreateTable
CREATE TABLE "Seat" (
    "id" SERIAL NOT NULL,
    "businessId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationSeat" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "seatId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationSeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Seat_businessId_idx" ON "Seat"("businessId");

-- CreateIndex
CREATE INDEX "Seat_status_idx" ON "Seat"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_businessId_name_key" ON "Seat"("businessId", "name");

-- CreateIndex
CREATE INDEX "ReservationSeat_seatId_idx" ON "ReservationSeat"("seatId");

-- CreateIndex
CREATE INDEX "ReservationSeat_reservationId_idx" ON "ReservationSeat"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSeat_reservationId_seatId_key" ON "ReservationSeat"("reservationId", "seatId");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSeat" ADD CONSTRAINT "ReservationSeat_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSeat" ADD CONSTRAINT "ReservationSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
