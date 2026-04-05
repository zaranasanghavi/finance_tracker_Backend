const jwt = require("jsonwebtoken");

exports.generateAccessToken = payload =>

 jwt.sign(
  payload,
  process.env.JWT_SECRET,
  { expiresIn: "15m" }
 );


exports.generateRefreshToken = payload =>
 jwt.sign(
  {
   ...payload,
   tokenId: Date.now() // 🔥 makes token unique
  },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: "7d" }
 );
