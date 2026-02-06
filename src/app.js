// src/app.js
require("dotenv").config();

// const { authMiddleware, adminOnly } = require("./middleware/auth");



// 서버 기본 세팅
const express = require("express");
const cors = require("cors");
const path = require("path");
// require('dotenv').config();

// Prisma 연결
const {PrismaClient } =require('@prisma/client');
const prisma =new PrismaClient();

const authRoutes = require('./routes/auth');
const { authMiddleware, adminOnly } = require("./middleware/auth");

const app = express();
const PORT = 4000;

// ✅ CORS 설정 (프론트: 3000 → 백: 4000)
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ✅ preflight(OPTIONS) 먼저 처리
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());


// ✅ authRoutes는 prisma를 주입해야 함!
app.use("/auth", authRoutes(prisma));

// 정적 파일 (필요하면 유지)
app.use(express.static(path.join(__dirname, "../public")));

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);


// app.use(express.json()); // POST/PUT 대비 OK



// app.use('/auth', authRoutes);
// app.use('/auth', authRoutes);


// app.use(express.static('public'));
// app.use(express.static(path.join(__dirname, "../public")));


// 서버 살아있는지 확인용
app.get('/health', (req, res) => {
  res.send('RentCore API OK');
});




const bcrypt = require("bcrypt");
// 사용자 생성 API
app.post('/users', async (req, res) => {
  try {
    const { name, email, password, studentId, grade, birthday, phoneNumber } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'name, email 필수' });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
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
app.get('/equipments',async (req, res) => {
const equipments =await prisma.equipment.findMany();
  res.json(equipments);
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
app.post('/equipments', authMiddleware, adminOnly, async (req, res) => {
const { name, category, managementNumber, imageUrl } = req.body;

const equipment =await prisma.equipment.create({
data: {
      name,
      category,
      managementNumber,
      imageUrl,
    },
  });

  res.status(201).json(equipment);
});

// 예약 추가
app.post('/reservations', async (req, res) => {
  try {
    const { equipmentId, startDate, endDate } = req.body;

    // const userId = Number(req.headers['x-user-id']);
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
app.get('/reservations', adminOnly, async (req, res) => {
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
app.get('/my/reservations', async (req, res) => {
  try {
    const userId = Number(req.headers['req.user.userId']);

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
        startDate: 'desc',
      },
    });

    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '내 예약 조회 실패' });
  }
});

app.get('/admin/calendar/reservations', adminOnly, async (req, res) => {
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

app.get('/my/calendar/reservations', async (req, res) => {
  try {
    const userId = Number(req.headers['req.user.userId']);

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
app.patch('/reservations/:id/approve', adminOnly, async (req, res) => {
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
app.patch('/reservations/:id/reject', adminOnly, async (req, res) => {
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


// 서버 실행
app.listen(4000, () => {
  console.log('RentCore server running on 4000');
});


