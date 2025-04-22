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
  getApplicationStats
} = require("../controllers/jobController");
const { protect, admin } = require("../middleware/authMiddleware"); 
const router = express.Router();

// Public Routes
router.get("/", getPublicJobs); 

// Admin Routes (specific routes before dynamic ones)
router.get("/stats", protect, admin, getJobStats); // Moved up
router.get("/stats/applications", protect, admin, getApplicationStats);
router.get("/admin/jobs", protect, admin, getAllJobsAdmin); 
router.post("/", createJob); 
router.put("/:id", protect, admin, updateJob);
router.delete("/:id", protect, admin, deleteJob);
router.patch("/:id/status", protect, admin, updateJobStatus);

// Public/Generic Routes (dynamic routes last)
router.get("/:id", getJobById); // Moved down
router.get("/posted-by/:postedBy", getJobsByPostedBy);

module.exports = router;