const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt"); 
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
        studentId: true,
      },
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "유저 조회 실패" });
  }
});

router.get("/admin/requests", authMiddleware, adminOnly, async (req, res) => {
  const { status, type } = req.query;

  try {
    let rental = [];
    let facility = [];

    // 🔹 장비 요청
    if (!type || type === "RENTAL") {
      rental = await prisma.rentalRequest.findMany({
        where: status ? { status } : {},
        include: {
          user: true,
          items: { include: { equipment: true } }
        }
      });

      rental = rental.map(r => ({
        ...r,
        type: "RENTAL",
        startDateTime: r.from,
        endDateTime: r.to    
      }));
    }

    // 🔹 시설 예약
    if (!type || type === "FACILITY") {
      facility = await prisma.facilityReservation.findMany({
        where: status ? { status } : {},
        include: {
          user: true,
          facility: true
        }
      });

      facility = facility.map(f => ({
        ...f,
        type: "FACILITY",
        startDateTime: f.startAt,
        endDateTime: f.endAt
      }));
    }

    const merged = [...rental, ...facility].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(merged);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "요청 목록 조회 실패" });
  }
});

router.get("/facility-requests/count", async (req, res) => {
  try {
    const count = await prisma.facilityReservation.count({
      where: {
        status: "REQUESTED",
      },
    });

    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

router.get("/rental-requests/count", async (req, res) => {
  try {
    const count = await prisma.reservation.count({
      where: {
        status: "PENDING",
      },
    });

    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      birthday,
      phoneNumber,
      adminCode,
    } = req.body;

    if (adminCode !== process.env.ADMIN_SECRET_CODE) {
      return res.status(403).json({ message: "관리자 코드 오류" });
    }

    const exists = await prisma.user.findUnique({
      where: { email },
    });

    if (exists) {
      return res.status(409).json({ message: "이미 존재하는 이메일" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        birthday: new Date(birthday),
        phoneNumber,
        role: "ADMIN",
      },
    });

    res.json({ message: "관리자 생성 완료", id: admin.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// 🔹 장비 요청 승인
router.patch("/rental-requests/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const rental = await prisma.rentalRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    // 🔥 알림 생성
    await prisma.notification.create({
      data: {
        userId: rental.userId,
        message: "장비 대여 요청이 승인되었습니다.",
      },
    });

    res.json({ message: "승인 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "승인 실패" });
  }
});

// 🔹 장비 요청 거절
router.patch("/rental-requests/:id/reject", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const rental = await prisma.rentalRequest.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await prisma.notification.create({
      data: {
        userId: rental.userId,
        message: "장비 대여 요청이 거절되었습니다.",
      },
    });

    res.json({ message: "거절 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "거절 실패" });
  }
});

// 🔹 시설 승인
router.patch("/facility-requests/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const facility = await prisma.facilityReservation.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    await prisma.notification.create({
      data: {
        userId: facility.userId,
        message: "시설 예약이 승인되었습니다.",
      },
    });

    res.json({ message: "시설 승인 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "시설 승인 실패" });
  }
});

// 🔹 시설 거절
router.patch("/facility-requests/:id/reject", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const facility = await prisma.facilityReservation.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await prisma.notification.create({
      data: {
        userId: facility.userId,
        message: "시설 예약이 거절되었습니다.",
      },
    });

    res.json({ message: "시설 거절 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "시설 거절 실패" });
  }
});

router.get("/notifications/unread-count", authMiddleware, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.userId,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "알림 조회 실패" });
  }
});


router.get("/layout-data", authMiddleware, adminOnly, async (req, res) => {
  try {

    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        role: true,
      },
    });

    const [rentalCount, facilityCount] = await Promise.all([
      prisma.rentalRequest.count({
        where: { status: "REQUESTED" }
      }),
      prisma.facilityReservation.count({
        where: { status: "REQUESTED" }
      })
    ]);

    res.json({
      user,
      pendingCount: rentalCount + facilityCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "layout data 실패" });
  }
});


module.exports = router;

