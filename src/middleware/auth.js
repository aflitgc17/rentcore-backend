const jwt = require("jsonwebtoken");

// 로그인 여부 확인
function authMiddleware(req, res, next) {
  try {
    // 1. 쿠키에서 먼저 확인
    let token = req.cookies?.token;

    // 2. 혹시 Authorization 헤더도 지원 (하위호환)
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role }

    next();
  } catch (err) {
    return res.status(403).json({ message: "토큰이 유효하지 않습니다." });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "관리자 권한이 필요합니다." });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };