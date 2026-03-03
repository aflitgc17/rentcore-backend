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

    const conflicts = await prisma.facilityReservation.findMany({
      where: whereClause,
      include: { user: true },
    });

    res.json(conflicts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "겹침 조회 실패" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    // console.log(" [POST BODY]:", req.body);
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
      if (
        !member.name ||
        !member.department ||
        !/^\d{10}$/.test(member.studentId)
      ) {
        return res.status(400).json({
          message: "팀원 정보가 올바르지 않습니다.",
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

  // 겹침 검사 (신청 + 승인 둘 다 막기)
  const conflict = await prisma.facilityReservation.findFirst({
    where: {
      facilityId: facilityRecord.id,
      status: { in: ["REQUESTED", "APPROVED"] },
      AND: [
        { startAt: { lt: endAt } },
        { endAt: { gt: startAt } },
      ],
    },
  });

  if (conflict) {
    return res.status(400).json({
      message: "이미 해당 시간에 신청/승인된 예약이 존재합니다.",
    });
  }

    // 2️⃣ facilityId로 저장
    const reservation = await prisma.facilityReservation.create({
      data: {
        facilityId: facilityRecord.id,
        startAt,
        endAt,
        computer: computer ?? null, 
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

    const reservation = await prisma.facilityReservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return res.status(404).json({ message: "예약 없음" });
    }

    // 🔥 승인 시 겹침 검사 (이미 승인된 것과만 비교)
    const conflict = await prisma.facilityReservation.findFirst({
      where: {
        id: { not: id },
        facilityId: reservation.facilityId,
        status: "APPROVED",
        AND: [
          { startAt: { lt: reservation.endAt } },
          { endAt: { gt: reservation.startAt } },
        ],
      },
    });

    if (conflict) {
      return res.status(400).json({
        message: "이미 승인된 예약과 시간이 겹칩니다.",
      });
    }

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

function splitDateTime(d) {
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
  };
}

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

    const isRecording = reservation.facility.name.includes("녹음");

    const pdfPath = isRecording
      ? path.join(process.cwd(), "src/templates/recordingForm.pdf")
      : path.join(process.cwd(), "src/templates/editingForm.pdf");

    const existingPdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(
      process.cwd(),
      "src/fonts/Noto_Sans_KR/static/NotoSansKR-Regular.ttf"
    );

    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);

    if (isRecording) {
      await drawRecordingForm(pdfDoc, reservation, customFont);
    } else {
      await drawEditingForm(pdfDoc, reservation, customFont);
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

function formatKoreanDateTimeRange(start, end) {
  const pad = (n) => String(n).padStart(2, "0");

  return `${start.getFullYear()} ${start.getMonth() + 1} ${start.getDate()} ${pad(start.getHours())}  ${pad(start.getMinutes())} `
    + ` ~ `
    + `${end.getFullYear()} ${end.getMonth() + 1} ${end.getDate()} ${pad(end.getHours())}  ${pad(end.getMinutes())} `;
}

function splitDateTimeFull(d) {
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
    hour: String(d.getHours()).padStart(2, "0"),
    minute: String(d.getMinutes()).padStart(2, "0"),
  };
}

function splitSimpleDate(d) {
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
  };
}

function formatPhoneNumber(phone) {
  if (!phone) return "";

  // 숫자만 남기기
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return phone; // 길이 이상하면 그냥 원본
}


function drawTextWithSpacing(page, text, x, y, font, size, spacing = 1) {
  let currentX = x;

  for (const char of text) {
    page.drawText(char, {
      x: currentX,
      y,
      size,
      font,
    });

    const charWidth = font.widthOfTextAtSize(char, size);
    currentX += charWidth + spacing; // 여기서 자간 조절
  }
}


function drawEditingForm(pdfDoc, reservation, font) {
  // console.log(" computer raw:", reservation.computer);
  const page = pdfDoc.getPages()[0];
  const { height } = page.getSize();

  const start = new Date(reservation.startAt);
  const end = new Date(reservation.endAt);

  const s = splitDateTimeFull(start);
  const e = splitDateTimeFull(end);

  const today = new Date();
  const t = splitSimpleDate(today);

  // 이름
  drawTextWithSpacing(
    page,
    reservation.user.name || "",
    180,
    height - 129,
    font,
    10,
    0.5  
  );

  // 연락처
  drawTextWithSpacing(
    page,
    formatPhoneNumber(reservation.user.phoneNumber) || "",
    147,
    height - 156,
    font,
    10,
    0.5  
  );
  
  // 학번
  drawTextWithSpacing(
    page,
    reservation.user.studentId || "",
    330,
    height - 156,
    font,
    10,
    0.5  
  );

  // 학과
  drawTextWithSpacing(
    page,
    reservation.user.department || "",
    380,
    height - 129,
    font,
    10,
    0.5  
  );

  // 학년
  page.drawText(reservation.user.grade || "", {
    x: 490,
    y: height - 156,
    size: 10,
    font,
  });

  // 컴퓨터 번호 (편집실만)

  const computerPositions = {
    "편집실1-1": { x: 192, y: height - 183 },
    "편집실1-2": { x: 295, y: height - 183 },
    "편집실2-1": { x: 400, y: height - 183 },
    "편집실2-2": { x: 505, y: height - 183 },
  };

  //  facility.name 기준으로 동그라미
  const facilityName = reservation.facility?.name;

  // console.log(" facility name:", facilityName);

  if (facilityName && computerPositions[facilityName]) {
    const pos = computerPositions[facilityName];

    page.drawCircle({
      x: pos.x,
      y: pos.y,
      size: 6,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0,
    });
  }

  // 사용 시간
  // ===== 시작 날짜 =====
  page.drawText(s.year,   { x: 130, y: height - 216, size: 10, font });
  page.drawText(s.month,  { x: 178, y: height - 216, size: 10, font });
  page.drawText(s.day,    { x: 213, y: height - 216, size: 10, font });
  page.drawText(s.hour,   { x: 255, y: height - 216, size: 10, font });
  page.drawText(s.minute, { x: 283, y: height - 216, size: 10, font });

  // ===== 종료 날짜 =====
  page.drawText(e.year,   { x: 340, y: height - 216, size: 10, font });
  page.drawText(e.month,  { x: 388, y: height - 216, size: 10, font });
  page.drawText(e.day,    { x: 423, y: height - 216, size: 10, font });
  page.drawText(e.hour,   { x: 465, y: height - 216, size: 10, font });
  page.drawText(e.minute, { x: 493, y: height - 216, size: 10, font });

  // 교과목명
  drawTextWithSpacing(
    page,
    reservation.subjectName || "",
    100,
    height - 285,
    font,
    10,
    0.5  
  );

  // 사용목적
  drawTextWithSpacing(
    page,
    reservation.purpose || "",
    100,
    height - 316,
    font,
    10,
    0.5  
  );

  // 팀원
    if (reservation.team && reservation.team.length > 0) {

    let nameY = height - 583;     // 이름 시작 위치
    let idY = height - 583;       // 학번 시작 위치
    let departmentY = height - 583; 

    reservation.team.forEach((member) => {

      //  이름
      drawTextWithSpacing(
        page,
        member.name || "",
        458,
        nameY,
        font,
        10,
        0.5
      );

      // 학번
      drawTextWithSpacing(
        page,
        member.studentId || "",
        323,
        idY,
        font,
        10,
        0.5
      );

      // 학과 
      drawTextWithSpacing(
        page,
        member.department || "",
        135,
        departmentY,
        font,
        10,
        0.5
      );

      nameY -= 28;   // 다음 줄
      idY -= 28;
      departmentY -= 28;
    });
  }

  // 날짜 (년 월 일)
  page.drawText(t.year,  { x: 163, y: height - 761, size: 12, font });
  page.drawText(t.month, { x: 213, y: height - 761, size: 12, font });
  page.drawText(t.day,   { x: 253, y: height - 761, size: 12, font });

  // 신청자 대표 이름
  page.drawText(reservation.user.name || "", {
    x: 378,
    y: height - 761,
    size: 12,
    font,
  });
}


// 녹음실
function drawRecordingForm(pdfDoc, reservation, font) {
  const page = pdfDoc.getPages()[0];
  const { height } = page.getSize();

  const start = new Date(reservation.startAt);
  const end = new Date(reservation.endAt);

  const s = splitDateTimeFull(start);
  const e = splitDateTimeFull(end);

  const today = new Date();
  const t = splitSimpleDate(today);


  // 대표자 이름
  drawTextWithSpacing(
    page,
    reservation.user.name || "",
    200,
    height - 97,
    font,
    10,
    0.5  
  );

  // 학번
  drawTextWithSpacing(
    page,
    reservation.user.studentId || "",
    322,
    height - 124,
    font,
    10,
    0.5  
  );

  // 연락처
  drawTextWithSpacing(
    page,
    formatPhoneNumber(reservation.user.phoneNumber) || "",
    145,
    height - 124,
    font,
    10,
    0.5  
  );

  // 학과
  drawTextWithSpacing(
    page,
    reservation.user.department || "",
    378,
    height - 97,
    font,
    10,
    0.5  
  );

  // 학년
  page.drawText(reservation.user.grade || "", {
    x: 489,
    y: height - 124,
    size: 10,
    font,
  });

  // 사용 시간
  // ===== 시작 날짜 =====
  page.drawText(s.year,   { x: 145, y: height - 150, size: 10, font });
  page.drawText(s.month,  { x: 193, y: height - 150, size: 10, font });
  page.drawText(s.day,    { x: 220, y: height - 150, size: 10, font });
  page.drawText(s.hour,   { x: 260, y: height - 150, size: 10, font });
  page.drawText(s.minute, { x: 283, y: height - 150, size: 10, font });

  // ===== 종료 날짜 =====
  page.drawText(e.year,   { x: 340, y: height - 150, size: 10, font });
  page.drawText(e.month,  { x: 388, y: height - 150, size: 10, font });
  page.drawText(e.day,    { x: 415, y: height - 150, size: 10, font });
  page.drawText(e.hour,   { x: 455, y: height - 150, size: 10, font });
  page.drawText(e.minute, { x: 478, y: height - 150, size: 10, font });

  // 교과목명
  drawTextWithSpacing(
    page,
    reservation.subjectName || "",
    100,
    height - 212,
    font,
    10,
    0.5  
  );

  // 사용목적
  drawTextWithSpacing(
    page,
    reservation.purpose || "",
    100,
    height - 242,
    font,
    10,
    0.5  
  );

  // 팀원
    if (reservation.team && reservation.team.length > 0) {

    let nameY = height - 507;     // 이름 시작 위치
    let idY = height - 507;       // 학번 시작 위치
    let departmentY = height - 507; 

    reservation.team.forEach((member) => {

      //  이름
      drawTextWithSpacing(
        page,
        member.name || "",
        458,
        nameY,
        font,
        10,
        0.5
      );

      // 학번
      drawTextWithSpacing(
        page,
        member.studentId || "",
        320,
        idY,
        font,
        10,
        0.5
      );

      // 학과 
      drawTextWithSpacing(
        page,
        member.department || "",
        138,
        departmentY,
        font,
        10,
        0.5
      );

      nameY -= 25;   // 다음 줄
      idY -= 25;
      departmentY -= 25;
    });
  }

  // 날짜 (년 월 일)
  page.drawText(t.year,  { x: 163, y: height - 770, size: 12, font });
  page.drawText(t.month, { x: 213, y: height - 770, size: 12, font });
  page.drawText(t.day,   { x: 253, y: height - 770, size: 12, font });

  // 신청자 대표 이름
  page.drawText(reservation.user.name || "", {
    x: 380,
    y: height - 770,
    size: 12,
    font,
  });
}

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
          status: { in: ["REQUESTED", "APPROVED"] },
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

      // 팀원 검증
      if (team && Array.isArray(team)) {
        for (const member of team) {
          if (
            !member.name ||
            !member.department ||
            !/^\d{10}$/.test(member.studentId)
          ) {
            return res.status(400).json({
              message: "팀원 정보가 올바르지 않습니다.",
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
    const { startAt, endAt, facilityId } = req.body;

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (start >= end) {
      return res.status(400).json({ message: "시간 범위 오류" });
    }

    const existing = await prisma.facilityReservation.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return res.status(404).json({ message: "예약 없음" });
    }

    
    const targetFacilityId = Number(facilityId);

    // 🔹 충돌 검사 (시설도 바뀌는 경우 고려)
    const conflict = await prisma.facilityReservation.findFirst({
      where: {
        id: { not: Number(id) },
        facilityId: targetFacilityId,
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
      data: {
        startAt: start,
        endAt: end,
        facilityId: targetFacilityId,   // 🔥 이 줄 추가
      },
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