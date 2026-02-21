const jwt = require("jsonwebtoken");

// 로그인 여부 확인
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role }
    next();
  } catch (err) {
    return res.status(403).json({ message: "토큰이 유효하지 않습니다." });
  }
}

// 관리자만 통과
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "관리자 권한이 필요합니다." });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
