const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authMiddleware, adminOnly } = require("../middleware/auth");


const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { facility } = req.query;

    const whereClause = {};

    if (facility && facility !== "전체") {
      whereClause.facility = {
        is: {
          name: {
            contains: facility,
          },
        },
      };
    }

    const reservations = await prisma.facilityReservation.findMany({
      where: whereClause,
      include: {
        user: true,
        facility: true,
      },
      orderBy: {
        startAt: "asc",
      },
    });

    // console.log("🔥 where:", whereClause);
    // console.log("🔥 result count:", reservations.length);

    res.json(reservations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

router.get("/conflicts", async (req, res) => {
  try {
    // console.log("🔥 [CONFLICTS] QUERY:", req.query);



    const { facilityName, date, start, end, computer } = req.query;

    if (!facilityName || !date || !start || !end) {
      return res.status(400).json({ message: "필수 값 누락" });
    }

    // 🔹 이름으로 시설 찾기
    const facilityRecord = await prisma.facility.findFirst({
      where: { name: facilityName },
    });
    // console.log("🔥 facilityRecord:", facilityRecord);

    if (!facilityRecord) {
      return res.status(400).json({ message: "시설 없음" });
    }

    const startAt = new Date(`${date}T${start}:00`);
    const endAt = new Date(`${date}T${end}:00`);

    const whereClause = {
      facilityId: facilityRecord.id,
      status: { in: ["REQUESTED", "APPROVED"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    };

    // if (computer) {
    //   whereClause.computer = computer;
    // }

    const conflicts = await prisma.facilityReservation.findMany({
      where: whereClause,
      include: { user: true },
    });

    // 🔹 1. 시설 이름 → id 조회
    // const facilityRecord = await prisma.facility.findFirst({
    //   where: { name: facility },
    // });

    // if (!facilityRecord) {
    //   return res.status(400).json({ message: "시설 없음" });
    // }


    // if (facility === "편집실" && computer) {
    //   whereClause.computer = computer;
    // }

    res.json(conflicts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "겹침 조회 실패" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    // console.log("🔥 [POST BODY]:", req.body);
    const {
      facilityName,
      date,
      startTime,
      endTime,
      computer,
      purpose,
      subjectName,
      team,
      headcount
    } = req.body;

  if (!facilityName || !date || !startTime || !endTime) {
    return res.status(400).json({ message: "필수 값 누락" });
  }

  if (team && Array.isArray(team)) {
    for (const member of team) {
      if (!/^\d{10}$/.test(member.studentId)) {
        return res.status(400).json({
          message: "팀원 학번은 10자리 숫자여야 합니다.",
        });
      }
    }
  }

  // 🔹 이름으로 시설 찾기
  const facilityRecord = await prisma.facility.findFirst({
    where: { name: facilityName },
  });

  if (!facilityRecord) {
    return res.status(400).json({ message: "존재하지 않는 시설입니다." });
  }

  const startAt = new Date(`${date}T${startTime}:00`);
  const endAt = new Date(`${date}T${endTime}:00`);

    // 2️⃣ facilityId로 저장
    const reservation = await prisma.facilityReservation.create({
      data: {
        facilityId: facilityRecord.id,
        startAt,
        endAt,
        // computer: computer ?? null, 
        subjectName,
        purpose,
        status: "REQUESTED",            
        headcount,
        team: team ?? [],
        userId: req.user.userId,
      },
    });

    res.json(reservation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "예약 실패" });
  }
});

// 승인
router.patch("/:id/approve", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const updated = await prisma.facilityReservation.update({
      where: { id },
      data: { status: "APPROVED" },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "승인 실패" });
  }
});

// 거절
router.patch("/:id/reject", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body; 

    const updated = await prisma.facilityReservation.update({
      where: { id },
      data: { 
        status: "REJECTED",
        rejectReason: reason,
       },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    console.error("시설 거절 에러:", err);
    res.status(500).json({ message: "거절 실패" });
  }
});

// 일반 사용자는 자기 예약만 보이게 하기
router.get("/my", authMiddleware, async (req, res) => {
  const reservations = await prisma.facilityReservation.findMany({
    where: { userId: req.user.userId },
    include: {
      facility: true,
      user: true,
    },
  });

  res.json(reservations);
});

// 요청 대기 개수 조회 (관리자용)
router.get("/pending-count", authMiddleware, async (req, res) => {
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

router.get("/:id/print", authMiddleware, async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id);

    const reservation = await prisma.facilityReservation.findUnique({
      where: { id: reservationId },
      include: {
        user: true,
        facility: true,
      },
    });

    if (!reservation) {
      return res.status(404).json({ message: "예약 없음" });
    }

    if (reservation.status !== "APPROVED") {
      return res.status(403).json({ message: "승인된 예약만 출력 가능" });
    }

    // 🔹 시설 종류에 따라 템플릿 선택
    let pdfPath;

    if (reservation.facility.name.includes("녹음")) {
      pdfPath = path.join(process.cwd(), "src/templates/recordingForm.pdf");
    } else {
      pdfPath = path.join(process.cwd(), "src/templates/editingForm.pdf");
    }

    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(
      process.cwd(),
      "src/fonts/Noto_Sans_KR/NotoSansKR-VariableFont_wght.ttf"
    );

    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();

    // ===== 사용자 정보 =====
    page.drawText(reservation.user.department || "", {
      x: 100,
      y: height - 120,
      size: 10,
      font: customFont,
    });

    page.drawText(reservation.user.grade || "", {
      x: 180,
      y: height - 120,
      size: 10,
      font: customFont,
    });

    page.drawText(reservation.user.studentId || "", {
      x: 100,
      y: height - 150,
      size: 10,
      font: customFont,
    });

    page.drawText(reservation.user.name || "", {
      x: 100,
      y: height - 180,
      size: 10,
      font: customFont,
    });

    page.drawText(reservation.user.phoneNumber || "", {
      x: 200,
      y: height - 180,
      size: 10,
      font: customFont,
    });

    // ===== 사용 기간 =====
    const start = new Date(reservation.startAt || reservation.start);
    const end = new Date(reservation.endAt || reservation.end);

    page.drawText(
      `${start.toLocaleDateString()} ${start.toLocaleTimeString()} 
       ~ ${end.toLocaleDateString()} ${end.toLocaleTimeString()}`,
      {
        x: 100,
        y: height - 210,
        size: 10,
        font: customFont,
      }
    );

    // ===== 편집실이면 컴퓨터 표시 =====
    if (reservation.facility.name.includes("편집")) {
      page.drawText(reservation.computer || "", {
        x: 100,
        y: height - 240,
        size: 10,
        font: customFont,
      });
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=facility_${reservationId}.pdf`
    );

    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PDF 생성 실패" });
  }
});

router.post("/manual", authMiddleware, adminOnly, async (req, res) => {
    try {
      const { userId, facilityId, startAt, endAt, subjectName, purpose, team } = req.body;

      if (!userId || !facilityId || !startAt || !endAt) {
        return res.status(400).json({ message: "필수 값 누락" });
      }

      const start = new Date(startAt);
      const end = new Date(endAt);

      if (start >= end) {
        return res.status(400).json({ message: "시간 범위 오류" });
      }

      // 충돌 검사
      const conflict = await prisma.facilityReservation.findFirst({
        where: {
          facilityId,
          status: "APPROVED",
          AND: [
            { startAt: { lt: end } },
            { endAt: { gt: start } },
          ],
        },
      });

      if (conflict) {
        return res.status(400).json({
          message: "이미 해당 시간에 예약이 존재합니다.",
        });
      }

      // 🔥 팀원 검증
      if (team && Array.isArray(team)) {
        for (const member of team) {
          if (!/^\d{10}$/.test(member.studentId)) {
            return res.status(400).json({
              message: "팀원 학번은 10자리 숫자여야 합니다.",
            });
          }
        }
      }

      const created = await prisma.facilityReservation.create({
        data: {
          userId,
          facilityId,
          startAt: start,
          endAt: end,
          subjectName,
          purpose,
          headcount: 1 + (team?.length || 0),
          team: team ?? [],
          status: "APPROVED",
        },
      });

      res.json(created);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "서버 오류" });
    }
  }
);


router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { startAt, endAt } = req.body;

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (start >= end) {
      return res.status(400).json({ message: "시간 범위 오류" });
    }

    // 🔹 기존 예약 먼저 조회
    const existing = await prisma.facilityReservation.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ message: "예약 없음" });
    }

    // 🔹 충돌 검사
    const conflict = await prisma.facilityReservation.findFirst({
      where: {
        id: { not: Number(id) },
        facilityId: existing.facilityId,
        status: "APPROVED",
        AND: [
          { startAt: { lt: end } },
          { endAt: { gt: start } },
        ],
      },
    });

    if (conflict) {
      return res.status(400).json({
        message: "이미 해당 시간에 예약이 존재합니다.",
      });
    }

    await prisma.facilityReservation.update({
      where: { id: Number(id) },
      data: { startAt: start, endAt: end },
    });

    res.json({ message: "수정 완료" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류" });
  }
});

router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const existing = await prisma.facilityReservation.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: "예약 없음" });
    }

    await prisma.facilityReservation.delete({
      where: { id },
    });

    res.json({ message: "삭제 완료" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "삭제 실패" });
  }
});

module.exports = router;
