const express = require("express");
const multer = require("multer");
const User = require("../models/User");
const { protect, admin } = require("../middleware/authMiddleware");
const router = express.Router();

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files in "uploads" directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Configure Multer to handle multiple file types
const upload = multer({ storage });

const fileFields = [
  { name: "profilePhoto", maxCount: 1 },
  { name: "resume", maxCount: 1 }
];

for (let i = 0; i < 10; i++) {
  fileFields.push({ name: `certificationImage-${i}`, maxCount: 1 });
}


const { 
  getAllUsers, 
  getUserById, 
  updateUser, 
  deleteUser, 
  changeUserRole,
  getUserStats,
  createUser
} = require("../controllers/userController");

// Admin routes
router.get("/users", protect, admin, getAllUsers);
router.get("/users/:id", protect, admin, getUserById);
router.put("/users/:id", protect, admin, updateUser);
router.delete("/users/:id", protect, admin, deleteUser);
router.put("/users/:id/role", protect, admin, changeUserRole);
router.post("/users", protect, admin, createUser);

// Dashboard statistics route - this was missing and causing the 404 error
router.get("/stats/users", protect, admin, getUserStats);

// User groups for email functionality
router.get("/user-groups", protect, admin, async (req, res) => {
  try {
    // Simple implementation - you can enhance this based on your needs
    const groups = [
      { id: "all", name: "All Users" },
      { id: "students", name: "All Students" },
      { id: "staff", name: "All Staff" }
    ];
    res.json(groups);
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;