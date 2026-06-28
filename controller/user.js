const User = require("../models/user");
const bcrypt = require("bcrypt");
const { sendVerify } = require("../middleware/email");
const { setuser } = require("../service/auth");

const userController = async (req, res) => {
  const body = req.body;
  const { email, username, password } = body;
  console.log("Signup attempt:", body);
  if (!email || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  const existingUser = await User.findOne({
    $or: [{ username: username }, { email: email }],
  });
  if (existingUser) {
    return res.status(400).json({ error: "Username or email already exists" });
  }
  const hashedpassword = await bcrypt.hash(password, 10);
  const verificationCode = Math.floor(
    100000 + Math.random() * 900000,
  ).toString();
  const result = await User.create({
    username: username,
    email: email,
    password: hashedpassword,
    verificationCode: verificationCode,
    verificationCodeExpiry: new Date(Date.now() + 5 * 60 * 1000),
  });

  if (!result) {
    return res.status(500).json({ error: "Failed to create user" });
  }
  sendVerify(email, verificationCode);
  return res.status(201).json({ message: "User created successfully. Please check your email for verification code.", user: { username: username, email: email }, });
};
//Login controller can be added here in the future
const loginController = async (req, res) => {
  const body = req.body;
  console.log("Login attempt:", body);
  if (!body.email || !body.password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const user = await User.findOne({ email: body.email });
  if (!user) {
    return res.status(400).json({ error: "Invalid email or password" });
  }
  const isPasswordValid = await bcrypt.compare(body.password, user.password);
  if (!isPasswordValid) {
    return res.status(400).json({ error: "Invalid email or password" });
  }
  if (!user.isVerified) {
    return res
      .status(400)
      .json({
        error:
          "User not verified. Please check your email for the verification code.",
      });
  }
  const token = setuser(user);
  res.cookie("token", token, {
    httpOnly: true,
    secure: true, // Change to true in production with HTTPS
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  return res
    .status(200)
    .json({
      message: "Login successful",
      user: { username: user.username, email: user.email },
    });
};

//OTP Verification controller
const verifyController = async (req, res) => {
  const { verificationCode } = req.body;
  if (!verificationCode) {
    return res.status(400).json({ error: "Verification code is required" });
  }
  const user = await User.findOne({
    verificationCode: verificationCode,
    verificationCodeExpiry: { $gt: new Date() },
  });
  if (!user) {
    return res
      .status(400)
      .json({ error: "Invalid or expired verification code" });
  }
  user.isVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpiry = null;
  await user.save();
  const token = setuser(user);
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000,
  });
  await User.syncIndexes();
  return res
    .status(200)
    .json({
      message: "User verified successfully",
      user: { username: user.username, email: user.email },
    });
};

const loginwithgooleController = async (profile) => {
  const email = profile.emails[0].value;
  const name = profile.email.split("@")[0];
  const googleId = profile.id;
  const profilePicture = profile.photos?.[0]?.value || null;
  console.log(profilePicture);

  const buildGoogleUsername = async () => {
    const rawBase = (name || email.split("@")[0] || "user")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._]/g, "");

    const base = rawBase || "user";
    let candidate = base;
    let counter = 1;
    while (await User.findOne({ username: candidate })) {
      candidate = `${base}${counter}`;
      counter += 1;
    }
    return candidate;
  };

  let user = await User.findOne({ email: email });
  if (!user) {
    const generatedUsername = await buildGoogleUsername();
    user = await User.create({
      username: generatedUsername,
      email: email,
      googleId: googleId,
      password: null,
      isVerified: true,
    });
  } else {
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }
  }

  return user;
};
module.exports = { userController, loginController, verifyController, loginwithgooleController };
