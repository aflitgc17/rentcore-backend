const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = express.Router();

// ✅ 시설 예약 전체 조회
router.get("/", authMiddleware, async (req, res) => {
  try {
    const reservations = await prisma.facilityReservation.findMany({
      include: {
        user: true,
        facility: true,
      },
    });

    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
