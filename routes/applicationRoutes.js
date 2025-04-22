const express = require("express");
const multer = require("multer");
const { protect, admin } = require("../middleware/authMiddleware");
const Application = require("../models/Application");
const Job = require("../models/Job");

const router = express.Router();

// Multer setup for resume upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, DOCX files are allowed"));
    }
  },
});

// Apply for a job
router.post("/", protect, upload.single("resume"), async (req, res) => {
  try {
    const { jobId, fullName, email, phone } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "approved") return res.status(403).json({ message: "Job not approved yet" });
    if (job.expiryDate && new Date(job.expiryDate) < new Date()) {
      return res.status(403).json({ message: "Job application period has expired" });
    }
    const existingApplication = await Application.findOne({ userId: req.user._id, jobId });
    if (existingApplication) return res.status(400).json({ message: "You have already applied for this job" });

    const resume = `/uploads/${req.file.filename}`;
    const application = new Application({
      userId: req.user._id,
      jobId,
      fullName,
      email,
      phone,
      resume,
    });

    await application.save();
    res.status(201).json({ message: "Application submitted successfully! Mazze karo!" });
  } catch (error) {
    console.error("Error applying for job:", error);
    res.status(500).json({ message: "Server error, bhai kuch gadbad ho gaya!" });
  }
});

router.get("/my-applications", protect, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user._id })
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");
    res.json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all jobs with application count (for Admin)
router.get("/jobs", protect, admin, async (req, res) => {
  try {
    const jobs = await Job.find().lean();
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const count = await Application.countDocuments({ jobId: job._id });
        return { ...job, applicationCount: count };
      })
    );
    res.json(jobsWithCounts);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get applications for a specific job (for Admin)
router.get("/applications/:jobId", protect, admin, async (req, res) => {
  try {
    const applications = await Application.find({ jobId: req.params.jobId })
      .populate("userId", "fullName email rollNo phone")
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");
    res.json(applications);
  } catch (error) {
    console.error("Error fetching job applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update application status (for Admin)
router.put("/applications/:id", protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate("userId", "fullName email rollNo phone")
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json(application);
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete application (for Admin)
router.delete("/applications/:id", protect, admin, async (req, res) => {
  try {
    const application = await Application.findByIdAndDelete(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;