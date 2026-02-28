const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authMiddleware, adminOnly } = require("../middleware/auth");
 

module.exports = (prisma) => {
  const router = express.Router();

  /**
   * 회원가입
   * POST /auth/register
   */
  router.post("/register", async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        studentId,
        department,
        grade,
        birthday,
        phoneNumber,
      } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "email, password 필수" });
      }

      if (!birthday) {
      return res.status(400).json({ message: "생년월일 필수" });
    }

    const parsedBirthday = new Date(birthday);

    if (isNaN(parsedBirthday.getTime())) {
      return res.status(400).json({ message: "생년월일 형식 오류" });
    }

    

      const hashed = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashed,
          studentId,
          department,
          // grade,
          grade: String(grade),
          // birthday: birthday ? new Date(birthday) : null,
          birthday: parsedBirthday,
          phoneNumber,
          role: "USER",
        },
      });

      res.status(201).json({ userId: user.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "회원가입 실패" });
    }
  });

  /**
   * 로그인
   * POST /auth/login
   */

  const cookieParser = require("cookie-parser");

  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "email, password 필수" });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: "이메일 또는 비밀번호 오류" });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(401).json({ message: "이메일 또는 비밀번호 오류" });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.cookie("token", token, {
      httpOnly: true,
      secure: false,       // 개발환경이면 false
      sameSite: "lax",
    });

    // 🔥 token을 JSON에도 포함해서 보내기
      return res.json({
        token,
        role: user.role,
      });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "로그인 실패" });
  }
});


  /**
 * 내 정보 조회
 * GET /auth/me
 */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    // req.user는 authMiddleware에서 JWT로 풀린 값
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "유저 정보 조회 실패" });
  }
});

/**
 * 로그아웃
 * POST /auth/logout
 */
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,   // 개발환경
    sameSite: "lax",
  });

  return res.json({ message: "로그아웃 성공" });
});



  return router;
};

