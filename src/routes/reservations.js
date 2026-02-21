const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * 🔹 특정 날짜에 예약된 장비 조회
 */
router.get("/by-date", async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: "날짜 필요" });
  }

  try {
    const d = new Date(date);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: "APPROVED",
        startDate: { lt: next },
        endDate: { gt: d }
      },
      include: { items: true }
    });

    const equipmentIds = reservations.flatMap(r =>
      r.items.map(i => i.equipmentId)
    );

    res.json([...new Set(equipmentIds)]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "조회 실패" });
  }
});


/**
 * 🔹 관리자 수동 예약 생성 (묶음 1건 + 장비 여러 개)
 */
router.post("/manual", async (req, res) => {
  try {
    const { userId, equipmentIds, startDate, endDate, subjectName, purpose } = req.body;

    if (!userId || !equipmentIds || equipmentIds.length === 0) {
      return res.status(400).json({ message: "필수값 누락" });
    }

    const created = await prisma.$transaction(async (tx) => {

      // 1️⃣ 예약 1건 생성
      const reservation = await tx.reservation.create({
        data: {
          userId: Number(userId),
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: "APPROVED",
          subjectName,
          purpose
        }
      });

      // 2️⃣ 예약 아이템 생성 (여러 장비)
      await tx.reservationItem.createMany({
        data: equipmentIds.map(id => ({
          reservationId: reservation.id,
          equipmentId: Number(id)
        }))
      });

      // 3️⃣ 장비 현재 대여 상태 업데이트
      await tx.equipment.updateMany({
        where: { id: { in: equipmentIds.map(Number) } },
        data: { currentRentalId: reservation.id }
      });

      return reservation;
    });

    res.json(created);

  } catch (err) {
    console.error("예약 생성 실패:", err);
    res.status(500).json({ message: "예약 생성 실패" });
  }
});


/**
 * 🔹 캘린더용 전체 예약 조회
 */
router.get("/calendar", async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { status: "APPROVED" },
      include: {
        user: {
        select: {
            name: true,
            studentId: true,  
        },
        },
        items: {
          include: { equipment: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(reservations);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "조회 실패" });
  }
});

router.get("/conflicts", async (req, res) => {
  const { start, end, excludeId } = req.query;

  const conflicts = await prisma.reservation.findMany({
    where: {
      id: { not: Number(excludeId) },
      status: "APPROVED",
      startDate: { lte: new Date(end) },
      endDate: { gte: new Date(start) },
    },
    include: {
      items: true,
    },
  });

  const equipmentIds = conflicts.flatMap(r =>
    r.items.map(i => i.equipmentId)
  );

  res.json(equipmentIds);
});


module.exports = router;
