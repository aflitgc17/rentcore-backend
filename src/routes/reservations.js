const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");
const { PDFDocument, rgb } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const fontkit = require("@pdf-lib/fontkit");
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


    if (!userId || !equipmentIds || equipmentIds.length === 0) {
      return res.status(400).json({ message: "필수값 누락" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // end.setDate(end.getDate() + 1);


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

    const start = new Date(startDate);
    const end = new Date(endDate);
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

    if (!start || !end) {
      return res.status(400).json({ message: "start, end 필요" });
    }

    const s = new Date(start);
    const e = new Date(end);

    //  하루 빼기 (올바른 변수 사용)
    // e.setDate(e.getDate() - 1);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ message: "날짜 형식 오류" });
    }

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

    const equipmentIds = conflicts.flatMap(r =>
      r.items.map(i => i.equipmentId)
    );

    res.json([...new Set(equipmentIds)]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "충돌 조회 실패" });
  }
});

router.get("/:id/print", authMiddleware, async (req, res) => {
  try {
    // console.log("PRINT 요청 ID:", req.params.id);
    const reservationId = parseInt(req.params.id);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        user: true,
        items: {
          include: {
            equipment: true,
          },
        },
      },
    });

    if (!reservation) {
      return res.status(404).json({ message: "예약 없음" });
    }
    // console.log("조회 결과:", reservation);

    // PDF 템플릿 불러오기
    const pdfPath = path.join(process.cwd(), "src/templates/rentalForm.pdf");
    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "src/fonts/Noto_Sans_KR/NotoSansKR-VariableFont_wght.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    const page = pdfDoc.getPages()[0];

    const { width, height } = page.getSize();
    // console.log("PDF width:", width);   
    // console.log("PDF height:", height); 

    // ===== 사용자 정보 입력 =====
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

    // ===== 사용기간 =====
    const start = new Date(reservation.startDate);
    const end = new Date(reservation.endDate);

    page.drawText(
      `${start.toLocaleDateString()} ${start.toLocaleTimeString()} ~ ${end.toLocaleDateString()} ${end.toLocaleTimeString()}`,
      {
        x: 100,
        y: height - 210,
        size: 10,
        font: customFont,
      }
    );

    // ===== 장비 목록 =====
    reservation.items.forEach((item, index) => {
      page.drawText(item.equipment.managementNumber, {
        x: 80,
        y: height - 350 - index * 20,
        size: 9,
        font: customFont,
      });

      page.drawText(item.equipment.name, {
        x: 130,
        y: height - 350 - index * 20,
        size: 9,
        font: customFont,
      });

      page.drawText(String(item.quantity), {
        x: 350,
        y: height - 350 - index * 20,
        size: 9,
        font: customFont,
      });
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=reservation_${reservationId}.pdf`
    );

    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PDF 생성 실패" });
  }
});

module.exports = router;
