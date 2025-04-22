// controllers/authController.js
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const { sendVerificationEmail } = require('../services/emailService');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.status !== "active") {
      return res.status(400).json({ message: "Please verify your email to activate your account" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { fullName, rollNo, email, password, role } = req.body;
  const allowedDomains = ["krmu.edu.in", "gmail.com"];

  try {
    // Validate email domain
    const domain = email.split("@")[1];
    if (!allowedDomains.includes(domain)) {
      return res.status(400).json({
        message: `Email must belong to ${allowedDomains.join(" or ")}.`,
      });
    }

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { rollNo }] });
    if (user) {
      return res.status(400).json({
        message: user.email === email ? "Email already exists" : "Roll No already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    user = new User({
      fullName,
      rollNo,
      email,
      password: hashedPassword,
      role: role || "student",
      status: "inactive", // Account inactive until verified
    });
    await user.save();

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await VerificationToken.create({
      userId: user._id,
      token: verificationToken,
    });

    // Send verification email
    await sendVerificationEmail(user, verificationToken);

    res.status(201).json({
      message: "Signup successful! Please check your email to verify your account within 15 minutes.",
    });
  } catch (error) {
    console.error("Error in register:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.body;

  try {
    const verificationToken = await VerificationToken.findOne({ token });
    if (!verificationToken) {
      return res.status(400).json({ message: "Invalid or expired verification token" });
    }

    const user = await User.findById(verificationToken.userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (user.status === "active") {
      return res.status(400).json({ message: "Email already verified" });
    }

    user.status = "active";
    await user.save();

    await VerificationToken.deleteOne({ token });

    const jwtToken = generateToken(user);
    res.status(200).json({
      message: "Email verified successfully",
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (error) {
    console.error("Error in verifyEmail:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.resendVerification = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found with this email" });
    }

    if (user.status === "active") {
      return res.status(400).json({ message: "This account is already verified" });
    }

    // Delete any existing tokens for this user
    await VerificationToken.deleteMany({ userId: user._id });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await VerificationToken.create({
      userId: user._id,
      token: verificationToken,
    });

    // Send verification email
    await sendVerificationEmail(user, verificationToken);

    res.status(200).json({
      message: "Verification email resent successfully! Please check your email within 15 minutes.",
    });
  } catch (error) {
    console.error("Error in resendVerification:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};