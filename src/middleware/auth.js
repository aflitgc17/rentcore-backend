const jwt = require("jsonwebtoken");

// 로그인 여부 확인
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }

  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Bearer 토큰 형식이 아닙니다." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role, iat, exp }
    next();
  } catch (err) {
    return res.status(403).json({ message: "토큰이 유효하지 않습니다." });
  }
}

// 관리자만 통과
function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "관리자 권한이 필요합니다." });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
