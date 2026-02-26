const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authMiddleware } = require("../middleware/auth");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const facilities = await prisma.facility.findMany();
    res.json(facilities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "시설 조회 실패" });
  }
});

module.exports = router;