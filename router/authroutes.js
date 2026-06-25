const express = require("express");
const password = require("../config/passwordconfig");
const { setuser } = require("../server/auth");

const router = express.Router();


router.get(
  "/google",
  password.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  password.authenticate("google", { failureRedirect: "/login", session: false }),
  (req, res) => {
    const token = setuser(req.user);
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Change to true in production with HTTPS
      sameSite: none,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    console.log("Google authentication successful, user:", req.user);
    return res.redirect(process.env.FRONTEND_URL);
  },
);

module.exports = router;
