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

    // 2️⃣ 거절된 신청 이력
    // const rejectedRequests = await prisma.rentalRequest.findMany({
    //   where: {
    //     userId,
    //     status: "REJECTED",
    //   },
    //   // where: { userId },
    //   include: {
    //     items: {
    //       include: {
    //         equipment: true,
    //       },
    //     },
    //   },
    //   orderBy: { createdAt: "desc" },
    // });

    const facilities = await prisma.facilityReservation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

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

// console.log("req.user:", req.user);
// console.log("조회 userId:", req.user.userId);

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


module.exports = router;
