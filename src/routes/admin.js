const express = require("express");
const router = express.Router();

const { authMiddleware, adminOnly } = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


// 관리자 테스트
router.get("/ping", (req, res) => {
  res.json({ message: "admin route ok" });
});

// 관리자 전용 대여 요청 조회
router.get("/rental-requests", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;

    const requests = await prisma.rentalRequest.findMany({
      where: status ? { status } : {},
      include: {
        user: {
          select: {
            name: true,
            email: true,
            studentId: true,  
          },
        },
        items: {
          include: { equipment: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "조회 실패" });
  }
});

// 🔹 승인 대기 개수 조회
router.get("/rental-requests/count", authMiddleware, adminOnly, async (req, res) => {
  try {
    const count = await prisma.rentalRequest.count({
      where: { status: "REQUESTED" }
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "카운트 조회 실패" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "유저 조회 실패" });
  }
});




module.exports = router;

