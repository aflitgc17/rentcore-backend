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
        startDate: { lte: d },
        endDate: { gte: d }
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

    console.log("프론트에서 받은 startDate:", startDate);
    console.log("프론트에서 받은 endDate:", endDate);


    if (!userId || !equipmentIds || equipmentIds.length === 0) {
      return res.status(400).json({ message: "필수값 누락" });
    }

    const start = startDate;
    const end = endDate;
    // end.setDate(end.getDate() + 1);

    console.log("new Date(startDate):", new Date(startDate));
    console.log("저장 직전 start:", start);

    const conflicts = await prisma.reservation.findMany({
      where: {
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: end },
        endDate: { gte: start },
        items: {
          some: {
            equipmentId: { in: equipmentIds.map(Number) }
          }
        }
      },
      include: { items: true }
    });

    console.log("=== 수동 생성 충돌 검사 ===");
    conflicts.forEach(r => {
      console.log("id:", r.id);
      console.log("start:", r.startDate);
      console.log("end:", r.endDate);
    });

    if (conflicts.length > 0) {
      return res.status(400).json({
        message: "이미 예약된 장비가 포함되어 있습니다."
      });
    }

    const created = await prisma.$transaction(async (tx) => {

      // 1️⃣ 예약 1건 생성
      const reservation = await tx.reservation.create({
        data: {
          userId: Number(userId),
          startDate: start,
          endDate: end,
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

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { startDate, endDate, equipmentIds } = req.body;

    const start = startDate;
    const end = endDate;
    // end.setDate(end.getDate() + 1);

    // 자기 자신 제외하고 충돌 검사
    const conflicts = await prisma.reservation.findMany({
      where: {
        id: { not: id },
        status: { in: ["APPROVED", "PENDING"] },
        startDate: { lte: end },
        endDate: { gte: start },
        items: {
          some: {
            equipmentId: { in: equipmentIds.map(Number) }
          }
        }
      }
    });

    if (conflicts.length > 0) {
      return res.status(400).json({
        message: "겹치는 예약이 있습니다."
      });
    }

    // 기존 아이템 삭제
    await prisma.reservationItem.deleteMany({
      where: { reservationId: id }
    });

    // 예약 업데이트
    await prisma.reservation.update({
      where: { id },
      data: {
        startDate: start,
        endDate: end,
      }
    });

    // 새 아이템 추가
    await prisma.reservationItem.createMany({
      data: equipmentIds.map(eid => ({
        reservationId: id,
        equipmentId: Number(eid)
      }))
    });

    res.json({ message: "수정 완료" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "수정 실패" });
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
  try {
    const { start, end, excludeId } = req.query;

    const s = new Date(start);
    const e = new Date(end);

    const conflicts = await prisma.reservation.findMany({
      where: {
        status: { in: ["APPROVED", "PENDING"] },

        // 진짜 겹침 조건
        startDate: { lte: e },
        endDate: { gte: s },

        ...(excludeId && { id: { not: Number(excludeId) } })
      },
      include: { items: true }
    });

    console.log("요청 start:", start);
    console.log("요청 end:", end);
    console.log("계산된 s:", s);
    console.log("계산된 e:", e);

    console.log("=== DB에 저장된 기존 예약 ===");
    const all = await prisma.reservation.findMany({
      include: { items: true }
    });
    all.forEach(r => {
      console.log("예약ID:", r.id);
      console.log("start:", r.startDate);
      console.log("end:", r.endDate);
    });

    const equipmentIds = conflicts.flatMap(r =>
      r.items.map(i => i.equipmentId)
    );

    res.json([...new Set(equipmentIds)]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "충돌 조회 실패" });
  }
});


module.exports = router;
