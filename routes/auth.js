const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

// Get current user details
router.get("/me", protect, (req, res) => {
  res.json({
    id: req.user._id,
    role: req.user.role,
    email: req.user.email, // Optional
  });
});

module.exports = router;