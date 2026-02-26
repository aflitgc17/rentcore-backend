const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

router.get("/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 1️⃣ 실제 예약 (관리자가 확정한 것)
    const reservations = await prisma.reservation.findMany({
      where: { userId },
      include: {
        rentalRequest: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { originalRequestCreatedAt: "asc" },
    });


    const facilities = await prisma.facilityReservation.findMany({
      where: { userId },
      include: {
        facility: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // console.log("시설 응답:", facilities);

    const rentalRequests = await prisma.rentalRequest.findMany({
      where: { userId },
      include: {
        items: {
          include: { equipment: true }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      reservations,
      rentalRequests,
      facilities,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "내 대여 현황 조회 실패" });
  }
});



router.get("/notifications", authMiddleware, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.userId },
    orderBy: { createdAt: "desc" },
  });


  const normalizeDate = (dateString) => {
  const d = new Date(dateString);
  d.setHours(0, 0, 0, 0); // 무조건 자정 고정
  return d;
};



  const unreadCount = notifications.filter(n => !n.isRead).length;

  res.json({ notifications, unreadCount });
});


router.patch("/notifications/read", authMiddleware, async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.userId,
      isRead: false,
    },
    data: { isRead: true },
  });

  res.json({ message: "읽음 처리 완료" });
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        department: true,
        studentId: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "프로필 조회 실패" });
  }
});


module.exports = router;
