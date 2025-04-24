// routes/profileRoutes.js
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  completeProfile,
  getProfile,
  uploadProfilePhoto,
  uploadResume,
  updateProfile,
} = require("../controllers/profileController");
const User = require("../models/User");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// Define file fields for profile endpoints
const fileFields = [
  { name: "profilePhoto", maxCount: 1 },
  { name: "resume", maxCount: 1 },
];

for (let i = 0; i < 10; i++) {
  fileFields.push({ name: `certificationImage-${i}`, maxCount: 1 });
}

// Routes
router.get("/me", protect, getProfile);
router.put("/complete", protect, upload.fields(fileFields), completeProfile);
router.post("/update", protect, upload.fields(fileFields), updateProfile);
router.post("/upload-photo", protect, upload.single("profilePhoto"), uploadProfilePhoto);
router.post("/upload-resume", protect, upload.single("resume"), uploadResume);

// Admin route to fetch any user's profile by ID
router.get("/user/:userId", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized as admin" });
    }

    const user = await User.findById(req.params.userId)
      .select("-password")
      .lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Check if user has a resume
router.get("/users/current/has-resume", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("resume");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasResume = user.resume !== null && user.resume !== undefined && user.resume !== "";
    res.json({ hasResume });
  } catch (error) {
    console.error("Error checking resume status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Fetch user's resume
router.get("/users/current/resume", protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("resume");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.resume) {
      return res.status(404).json({ message: "No resume found for this user" });
    }

    res.json({ resumePath: user.resume });
  } catch (error) {
    console.error("Error fetching resume:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;