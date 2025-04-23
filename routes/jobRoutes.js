// In jobRoutes.js
const express = require("express");
const {
  createJob,
  getPublicJobs,
  getAllJobsAdmin,
  getJobById,
  updateJob,
  deleteJob,
  updateJobStatus,
  getJobsByPostedBy,
  searchJobsBySkills,
  searchJobsByCategory,
  getJobStats,
  getApplicationStats,
} = require("../controllers/jobController");
const { protect, admin, staffOrAdmin } = require("../middleware/authMiddleware");
const router = express.Router();

// Public Routes
router.get("/", getPublicJobs);

// Admin Routes
router.get("/stats", protect, admin, getJobStats);
router.get("/stats/applications", protect, admin, getApplicationStats);
router.get("/admin/jobs", protect, admin, getAllJobsAdmin);
router.post("/", protect, admin, createJob); 
router.put("/:id", protect, admin, updateJob);
router.delete("/:id", protect, admin, deleteJob);
router.patch("/:id/status", protect, admin, updateJobStatus);

// Public/Generic Routes
router.get("/:id", getJobById);
router.get("/posted-by/:postedBy", getJobsByPostedBy);

module.exports = router;