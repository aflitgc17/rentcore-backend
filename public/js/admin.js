const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

// 관리자 회원가입
router.post("/admin/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      adminCode,
    } = req.body;

    if (adminCode !== process.env.ADMIN_CODE) {
      return res.status(403).json({ message: "관리자 코드가 올바르지 않습니다" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        birthday: parsedBirthday,
        phoneNumber,
        role: UserRole.ADMIN,

        // 관리자 전용
        studentId: null,
        grade: null,
        department: null,
      },
    });

    res.status(201).json(admin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "관리자 회원가입 실패" });
  }
});

module.exports = router;
