// src/app.js
require("dotenv").config();

// 서버 기본 세팅
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");

const cookieParser = require("cookie-parser");


// Prisma 연결
const {PrismaClient } =require('@prisma/client');

const authRoutes = require('./routes/auth');
const adminRoutes = require("./routes/admin");
const { authMiddleware, adminOnly } = require("./middleware/auth");
const facilityReservationRoutes = require("./routes/facilityReservations");


const prisma = new PrismaClient();
const app = express();
const PORT = 4000;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());

app.options("*", cors());
app.use(express.json());


/* ======================
   라우트 연결
====================== */
app.use("/auth", authRoutes(prisma));
app.use("/admin", adminRoutes);
app.use("/facility-reservations", facilityReservationRoutes);

const rentalRequestsRoutes = require("./routes/rentalRequests");
app.use("/rental-requests", rentalRequestsRoutes);

const equipmentRoutes = require("./routes/equipments");
app.use("/equipments", equipmentRoutes(prisma));

const myRoutes = require("./routes/my");
app.use("/my", myRoutes);

app.use("/", adminRoutes); 

const reservationRoutes = require("./routes/reservations");
app.use("/reservations", reservationRoutes);


/* ======================
   정적 파일
====================== */
app.use(express.static(path.join(__dirname, "../public")));


// 서버 살아있는지 확인용
app.get('/health', (req, res) => {
  res.send('RentCore API OK');
});

// 사용자 생성 API
app.post('/users', async (req, res) => {
  try {
    const { name, email, password, studentId, grade, birthday, phoneNumber } = req.body;

    if (!name || !email || !password || !studentId || !grade || !birthday || !phoneNumber) {
      return res.status(400).json({ message: 'name, email, password, studentId, grade, birthday, phoneNumber 필수' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        studentId,
        grade,
        birthday : new Date(birthday),
        phoneNumber,

      },
    });

    res.status(201).json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// 장비 목록 조회
app.get("/equipments", async (req, res) => {
  try {
    const equipments = await prisma.equipment.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(equipments);
  } catch (err) {
    res.status(500).json({ message: "장비 조회 실패" });
  }
});


// 특정 장비 조회
app.get('/equipments/:id', async (req, res) => {
  const { id } = req.params;

  const equipment = await prisma.equipment.findUnique({
    where: {
      id: Number(id),
    },
  });

  if (!equipment) {
    return res.status(404).json({ message: '장비를 찾을 수 없습니다.' });
  }

  res.json(equipment);
});

// 장비 등록
app.post("/equipments", async (req, res) => {
  try {
    const { name, managementNumber, category, status, imageUrl, usageInfo } = req.body;

    const statusMap = {
      available: "AVAILABLE",
      rented: "RENTED",
      damaged: "BROKEN",
      reserved: "RENTED",
    };

    const equipment = await prisma.equipment.create({
      data: {
      managementNumber: item.managementNumber,
      assetNumber: item.assetNumber,
      classification: item.classification,
      accessories: item.accessories,
      note: item.note,
      category: item.category,
      status: "AVAILABLE",
    }
  });

    res.status(201).json(equipment);
  } catch (err) {
    res.status(500).json({ message: "장비 등록 실패" });
  }
});


// 예약 추가
app.post('/reservations', authMiddleware, async (req, res) => {
  try {
    const { equipmentId, startDate, endDate } = req.body;

    const userId = req.user.userId;

    if (!equipmentId || !startDate || !endDate || !userId) {
      return res.status(400).json({ message: '필수 값 누락' });
    }

    const eqId = Number(equipmentId);
    const usId = Number(userId);
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json({ message: '날짜 범위 오류' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ 장비 존재 확인
      const equipment = await tx.equipment.findUnique({
        where: { id: eqId },
      });

      if (!equipment) {
        throw new Error('장비 없음');
      }

      // 2️⃣ 날짜 겹치는 예약 있는지 확인
      const conflict = await tx.reservation.findFirst({
        where: {
          equipmentId: eqId,
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } },
          ],
        },
      });

      if (conflict) {
        throw new Error('이미 예약된 장비입니다');
      }

      // 3️⃣ 예약 생성
      return await tx.reservation.create({
        data: {
          equipmentId: eqId,
          userId: userId,   
          startDate: start,
          endDate: end,
        },
      });
    });

    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// 예약 조회(관리자)
app.get('/reservations', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        equipment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '예약 조회 실패' });
  }
});

// 예약 조회(캘린더)
app.get('/my/reservations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;


    if (!userId) {
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        userId: userId,
      },
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '내 예약 조회 실패' });
  }
});

app.get('/admin/calendar/reservations', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        user: {
          select: {
            name: true,
            studentId: true, // 학번 컬럼명에 맞게 수정
          },
        },
        equipment: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    // 캘린더용으로 가공
    const calendarData = reservations.map(r => ({
      title: `${r.user.name} (${r.user.studentId}) - ${r.equipment.name}`,
      start: r.startDate,
      end: r.endDate,
    }));

    res.json(calendarData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '관리자 캘린더 조회 실패' });
  }
});

app.get('/my/calendar/reservations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;


    if (!userId) {
      return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        userId,
      },
      include: {
        equipment: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    const calendarData = reservations.map(r => ({
      title: r.equipment.name,
      start: r.startDate,
      end: r.endDate,
    }));

    res.json(calendarData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '내 캘린더 조회 실패' });
  }
});

// 예약 승인 API
app.patch('/reservations/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);

    // 1. 예약 조회
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ message: '예약을 찾을 수 없습니다.' });
    }

    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ message: '이미 처리된 예약입니다.' });
    }

    // 2. 겹치는 예약 검사 (같은 장비 + 승인된 예약)
    const conflict = await prisma.reservation.findFirst({
      where: {
        equipmentId: reservation.equipmentId,
        status: 'APPROVED',
        startDate: { lt: reservation.endDate },
        endDate: { gt: reservation.startDate },
      },
    });

    if (conflict) {
      return res.status(409).json({
        message: '해당 시간에 이미 승인된 예약이 있습니다.',
      });
    }

    // 3. 승인 처리
    const approvedReservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'APPROVED',
        rejectReason: null, // 혹시 남아있을 수 있으니 초기화
      },
    });

    res.json({
      message: '예약이 승인되었습니다.',
      reservation: approvedReservation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '예약 승인 실패' });
  }
});


// 예약 거절 API
app.patch('/reservations/:id/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: '거절 사유를 입력해주세요.' });
    }

    // 1. 예약 조회
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ message: '예약을 찾을 수 없습니다.' });
    }

    if (reservation.status !== 'PENDING') {
      return res.status(400).json({ message: '이미 처리된 예약입니다.' });
    }

    // 2. 거절 처리
    const rejectedReservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
      },
    });

    res.json({
      message: '예약이 거절되었습니다.',
      reservation: rejectedReservation,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '예약 거절 실패' });
  }
});

app.get("/facility-reservations", authMiddleware, async (req, res) => {
  const today00 = new Date();
  today00.setHours(0, 0, 0, 0);

  const reservations = await prisma.facilityReservation.findMany({
    where: { startAt: { gte: today00 } },
    orderBy: { startAt: "asc" },
  });

  res.json(reservations);
});

app.get("/reservations/calendar", async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        user: true,
        items: {             
          include: {
            equipment: true,
          },
        },
      },
    });

    res.json(reservations);
  } catch (error) {
    console.error("캘린더 에러:", error);
    res.status(500).json({ message: "캘린더 조회 실패", error });
  }
});


app.post("/equipments/bulk", async (req, res) => {
  try {
    const equipments = req.body;

    const statusMap = {
      available: "AVAILABLE",
      rented: "RENTED",
      damaged: "BROKEN",
      reserved: "RENTED",
    };

    // ✅ 0) 엑셀에 있는 managementNumber 목록
    const incomingMNs = equipments.map((e) => e.managementNumber);

    // ✅ 1) 엑셀에 없는 장비는 비활성화 (삭제 X)
    await prisma.equipment.updateMany({
      where: {
        managementNumber: { notIn: incomingMNs },
      },
      data: { isActive: false },
    });

    // ✅ 2) 엑셀에 있는 장비는 upsert로 갱신 + 활성화
    for (const e of equipments) {
      await prisma.equipment.upsert({
        where: { managementNumber: e.managementNumber },
        update: {
          assetNumber: e.assetNumber || null,
          classification: e.classification || null,
          accessories: e.accessories || null,
          note: e.note || null,
          category: e.category,
          name: e.name,
          status: statusMap[e.status] || "AVAILABLE",
          isActive: true, // ✅ 활성화
        },
        create: {
          managementNumber: e.managementNumber,
          assetNumber: e.assetNumber || null,
          classification: e.classification || null,
          accessories: e.accessories || null,
          note: e.note || null,
          category: e.category,
          name: e.name,
          status: statusMap[e.status] || "AVAILABLE",
          isActive: true, // ✅ 활성화
        },
      });
    }

    res.json({ message: "엑셀 기준으로 동기화 완료(삭제 없이 안전)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "동기화 실패" });
  }
});



app.put("/equipments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      managementNumber,
      assetNumber,
      classification,
      accessories,
      note,
      category,
      name,
      status,
    } = req.body;

    const statusMap = {
      available: "AVAILABLE",
      rented: "RENTED",
      damaged: "BROKEN",
      reserved: "RENTED",
    };

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        managementNumber,
        assetNumber,
        classification,
        accessories,
        note,
        category,
        name,
        status: statusMap[status] || "AVAILABLE",
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "장비 수정 실패" });
  }
});


// 장비 삭제
app.delete("/equipments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.equipment.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: "비활성화 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "장비 삭제 실패" });
  }
});


// app.get("/equipments/:id/reservations", async (req, res) => {
//   const equipmentId = Number(req.params.id);

//   const reservations = await prisma.reservation.findMany({
//     where: { equipmentId },
//     select: {
//       startDate: true,
//       endDate: true,
//     },
//   });

//   res.json(reservations);
// });

// PUT /reservations/:id
app.put("/reservations/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { startDate, endDate, equipmentIds } = req.body;

  await prisma.reservationItem.deleteMany({
    where: { reservationId: id },
  });

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      items: {
        create: equipmentIds.map((eid) => ({
          equipmentId: Number(eid),
        })),
      },
    },
  });

  res.json(updated);
});



app.delete("/reservations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await prisma.reservation.delete({
      where: { id },
    });

    res.json({ message: "삭제 완료" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "삭제 실패" });
  }
});



// 서버 실행
app.listen(4000, () => {
  console.log('RentCore server running on 4000');
});


