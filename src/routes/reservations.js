const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");
const fs = require("fs");
const path = require("path");
const fontkit = require("@pdf-lib/fontkit");
const {
  PDFDocument,
  rgb,
  StandardFonts,
  pushGraphicsState,
  popGraphicsState,
  setCharacterSpacing,
  setWordSpacing,
} = require("pdf-lib");
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

function fmtShortDateTime(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = d.getHours();       
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${m}/${day} ${hh}:${mm}`;
}

function splitDateTime(d) {
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
  };
}

function toHalfWidth(str) {
  if (!str) return str;

  return str
    // 전각 영문/숫자 → 반각
    .replace(/[！-～]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    )
    // 전각 공백 → 일반 공백
    .replace(/　/g, " ");
}

function normalizeSpaces(str) {
  if (!str) return "";

  return str
    .replace(/\u00A0/g, " ")     // NBSP
    .replace(/\u200B/g, "")      // zero-width space
    .replace(/\u2009/g, " ")     // thin space
    .replace(/\u202F/g, " ")     // narrow no-break space
    .replace(/\u3000/g, " ")     // 전각 공백
    .replace(/(\d)\s+(?=\d)/g, "$1") 
    .replace(/\s+/g, " ")        // 공백 여러개 -> 1개
    .trim();
}

function normalizeItemName(str) {
  if (!str) return "";

  let s = str.normalize("NFKC");

  // 보이지 않는 문자 제거
  s = s.replace(/[\p{Cf}]/gu, "");

  // 전각 공백 → 일반 공백
  s = s.replace(/\u3000/g, " ");

  // 여러 공백 → 한 칸
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function formatPhoneNumber(phone) {
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return phone;
}

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

    const pdfPath = path.join(process.cwd(), "src/templates/rentalForm.pdf");
    // 1️⃣ 템플릿 PDF 따로 로드
    const templatePdfBytes = fs.readFileSync(pdfPath);
    const templateDoc = await PDFDocument.load(templatePdfBytes);

    // 2️⃣ 새 PDF 생성
    const pdfDoc = await PDFDocument.create();

    // 3️⃣ 템플릿 페이지 복사
    const [templatePage] = await pdfDoc.copyPages(templateDoc, [0]);

    // 4️⃣ 새 페이지에 추가
    const page = pdfDoc.addPage(templatePage);

    // 템플릿을 배경처럼 그리기
    // page.drawPage(templatePage);

    pdfDoc.registerFontkit(fontkit);

    const fontPath = path.join(process.cwd(), "src/fonts/Noto_Sans_KR/static/NotoSansKR-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const customFont = await pdfDoc.embedFont(fontBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // const page = pdfDoc.getPages()[0];

    const { width, height } = page.getSize();
    // console.log("PDF width:", width);   
    // console.log("PDF height:", height); 

    function drawCenteredText(page, text, boxX, boxY, boxWidth, boxHeight, font, size) {
      if (!text) return;

      const textWidth = font.widthOfTextAtSize(text, size);

      // baseline 보정값 (폰트마다 조금 다름, 0.3~0.35가 적당)
      const baselineOffset = size * 0.3;

      const x = boxX + (boxWidth - textWidth) / 2;
      const y = boxY + (boxHeight / 2) - baselineOffset;

      page.drawText(text, { x, y, size, font });
    }

    function drawWrappedText(page, text, x, y, maxWidth, font, size) {
      let line = "";
      let offsetY = 0;

      for (let i = 0; i < text.length; i++) {
        const testLine = line + text[i];
        const width = font.widthOfTextAtSize(testLine, size);

        if (width > maxWidth) {
          page.drawText(line, { x, y: y - offsetY, size, font });
          line = text[i];
          offsetY += size + 2;
        } else {
          line = testLine;
        }
      }

      page.drawText(line, { x, y: y - offsetY, size, font });
    }

    function wrapTextByWidth(text, font, size, maxWidth) {
      const lines = [];
      let line = "";

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const test = line + ch;
        const w = font.widthOfTextAtSize(test, size);

        if (w > maxWidth && line.length > 0) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    function ellipsizeToWidth(text, font, size, maxWidth) {
      const ell = "…";
      if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

      let cut = text;
      while (cut.length > 0) {
        const test = cut + ell;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) return test;
        cut = cut.slice(0, -1);
      }
      return ell;
    }

    /**
     * 셀(박스) 안에만 텍스트가 들어가게 출력 (wrap + maxLines + ellipsis)
     * boxX, boxY는 "박스의 왼쪽 아래" 기준
     */
    function drawTextInBox(page, text, boxX, boxY, boxWidth, boxHeight, font, size, options = {}) {
      if (!text) return;

      const paddingX = options.paddingX ?? 2;
      const paddingY = options.paddingY ?? 2;
      const maxLines = options.maxLines ?? 2;
      const lineHeight = options.lineHeight ?? (size + 1);

      const maxWidth = boxWidth - paddingX * 2;
      const maxHeight = boxHeight - paddingY * 2;

      // 1) 우선 wrap
      let lines = wrapTextByWidth(text, font, size, maxWidth);

      // 2) maxLines 제한 + 마지막 줄 … 처리
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = ellipsizeToWidth(lines[maxLines - 1], font, size, maxWidth);
      }

      // 3) 세로로도 박스 넘치면(폰트 너무 큰 경우) 줄수 줄이고 … 처리
      const fitLines = Math.max(1, Math.floor(maxHeight / lineHeight));
      if (lines.length > fitLines) {
        lines = lines.slice(0, fitLines);
        lines[fitLines - 1] = ellipsizeToWidth(lines[fitLines - 1], font, size, maxWidth);
      }

      // 4) "박스 안에서 위->아래로" 그리기 (절대 아래칸 침범 안 함)
      // boxY는 bottom이니까, top = boxY + boxHeight
      const topY = boxY + boxHeight - paddingY;
      for (let i = 0; i < lines.length; i++) {
        page.drawText(lines[i], {
          x: boxX + paddingX,
          y: topY - (i + 1) * lineHeight,
          size,
          font,
        });
      }
    }

    // ===== 사용자 정보 입력 =====
    drawCenteredText(
      page,
      reservation.user.department || "",
      110,                // 칸 왼쪽 x
      height - 106,      // 칸 아래 y
      140,               // 칸 너비
      25,                // 칸 높이
      customFont,
      10
    );

    drawCenteredText(
      page,
      reservation.user.grade || "",
      215,
      height - 106,
      60,
      25,
      customFont,
      10
    );


    drawCenteredText(
      page,
      reservation.user.studentId || "",
      170,
      height - 130,
      60,
      25,
      customFont,
      10
    );


    drawCenteredText(
      page,
      reservation.user.name || "",
      170,
      height - 154,
      60,
      25,
      customFont,
      10
    );


    drawCenteredText(
      page,
      formatPhoneNumber(reservation.user.phoneNumber),
      390,
      height - 154,
      60,
      25,
      customFont,
      10
    );

    // ===== 사용기간 =====
    const start = new Date(reservation.startDate);
    const end = new Date(reservation.endDate);

    const startInfo = splitDateTime(start);
    const endInfo = splitDateTime(end);

    // ===== 반출 =====
    page.drawText(String(startInfo.year), {
      x: 390,
      y: height - 96,
      size: 10,
      font: customFont,
    });

    page.drawText(String(startInfo.month), {
      x: 438,
      y: height - 96,
      size: 10,
      font: customFont,
    });

    page.drawText(String(startInfo.day), {
      x: 464,
      y: height - 96,
      size: 10,
      font: customFont,
    });

    page.drawText(String(startInfo.hour), {
      x: 496,
      y: height - 96,
      size: 10,
      font: customFont,
    });


    // ===== 반납 =====
    page.drawText(String(endInfo.year), {
      x: 390,
      y: height - 120,
      size: 10,
      font: customFont,
    });

    page.drawText(String(endInfo.month), {
      x: 438,
      y: height - 120,
      size: 10,
      font: customFont,
    });

    page.drawText(String(endInfo.day), {
      x: 464,
      y: height - 120,
      size: 10,
      font: customFont,
    });

    page.drawText(String(endInfo.hour), {
      x: 496,
      y: height - 120,
      size: 10,
      font: customFont,
    });

    // ===== 교과목명 =====
    if (reservation.subjectName) {
      drawWrappedText(
        page,
        reservation.subjectName,
        173,                // x 위치 (교과목명 칸 시작 위치에 맞게 조절)
        height - 189,       // y 위치 (템플릿에 맞게 조절 필요)
        350,                // 최대 너비
        customFont,
        10
      );
    }

    // ===== 사용 목적 =====
    if (reservation.purpose) {
      drawWrappedText(
        page,
        reservation.purpose,
        120,
        height - 204,
        350,
        customFont,
        10
      );
    }

    // ===== 대여 신청 대표자 (하단) =====
    drawCenteredText(
      page,
      reservation.user.name || "",
      300,              // ← 이름 칸 x좌표 (조절)
      height - 760,     // ← y좌표 (조절)
      120,
      20,
      customFont,
      11
    );

    drawCenteredText(
      page,
      reservation.user.studentId || "",
      414,              // ← 학번 칸 x좌표 (조절)
      height - 760,
      120,
      20,
      customFont,
      11
    );

    // ===== 장비 목록 =====
    reservation.items.forEach((item, index) => {
      const isRightColumn = index >= 9;
      const rowIndex = isRightColumn ? index - 9 : index;

      const rowHeight = 20.3;

      // rowBoxY는 "그 행 칸의 bottom"
      const rowBoxY = height - 300 - rowIndex * rowHeight;
      const rowBoxH = rowHeight;

      const managementX = isRightColumn ? 313 : 88;
      const nameX       = isRightColumn ? 346 : 120;

      // 관리번호(한 줄 고정)
      page.drawText(item.equipment.managementNumber || "", {
        x: managementX,
        y: rowBoxY + 5,     // 칸 안에서 적당히
        size: 9,
        font: helveticaFont,
      });

      // const before = item.equipment.name || "";
      // const after  = normalizeItemName(before);

      // console.log("NAME BEFORE:", JSON.stringify(before));
      // console.log("NAME AFTER :", JSON.stringify(after));

      // const rawName = after;


      const rawName = normalizeItemName(item.equipment.name || "이름 없음");

      // 한글 포함 여부 체크 (가-힣, 자모까지 넓게)
      const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(rawName);

      const fontToUse = hasKorean ? customFont : helveticaFont;


      // const fontToUse = /^[A-Za-z0-9\s\-\.\(\)]+$/.test(rawName)
      //   ? helveticaFont
      //   : customFont;

      // const fontToUse = helveticaFont;

      // 🔧 템플릿에서 남아있는 자간/단어간격 리셋
      page.pushOperators(
        pushGraphicsState(),
        setCharacterSpacing(-0.3),
        setWordSpacing(0),
      );

      // 품목명은 "칸 안에서 2줄까지만", 넘치면 …
      drawTextInBox(
        page,
        rawName,
        nameX,
        rowBoxY,
        150,
        rowBoxH,
        fontToUse,
        8.5,  // 1줄이면 9도 OK (8~9 중 취향)
        { maxLines: 2, lineHeight: 9, paddingX: 2, paddingY: 1 }
      );
      page.pushOperators(popGraphicsState());
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
