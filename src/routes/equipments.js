module.exports = (prisma) => {
  const router = require("express").Router();

  router.get("/:id/reservations", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.id);

      const reservations = await prisma.reservation.findMany({
        where: {
          status: {
            in: ["PENDING", "APPROVED"],
          },
          items: {
            some: {
              equipmentId: equipmentId,
            },
          },
        },
        select: {
          startDate: true,
          endDate: true,
        },
      });

      res.json(reservations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "예약 조회 실패" });
    }
  });


  return router;
};
