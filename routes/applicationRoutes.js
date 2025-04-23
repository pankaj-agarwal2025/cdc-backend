const express = require("express");
const multer = require("multer");
const { protect, admin } = require("../middleware/authMiddleware");
const Application = require("../models/Application");
const Job = require("../models/Job");
const emailService = require("../services/emailService");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Ensure Uploads directory exists
const uploadDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Created Uploads directory:", uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
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

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err);
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  } else if (err) {
    console.error("File upload error:", err);
    return res.status(400).json({ message: err.message });
  }
  next();
};

router.post("/", protect, upload.single("resume"), handleMulterError, async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("File:", req.file);

    const { jobId, fullName, email, phone } = req.body;
    if (!jobId || !fullName || !email || !phone || !req.file) {
      return res.status(400).json({ message: "Missing required fields: jobId, fullName, email, phone, or resume" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      console.error("Job not found:", jobId);
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status !== "approved") {
      console.error("Job not approved:", jobId);
      return res.status(403).json({ message: "Job not approved yet" });
    }
    if (job.expiryDate && new Date(job.expiryDate) < new Date()) {
      console.error("Job expired:", jobId);
      return res.status(403).json({ message: "Job application period has expired" });
    }

    const existingApplication = await Application.findOne({ userId: req.user._id, jobId });
    if (existingApplication) {
      console.error("Duplicate application:", { userId: req.user._id, jobId });
      return res.status(400).json({ message: "You have already applied for this job" });
    }

    const resume = `/Uploads/${req.file.filename}`;
    // Verify file exists
    if (!fs.existsSync(path.join(uploadDir, req.file.filename))) {
      console.error("Uploaded file not found:", req.file.filename);
      return res.status(500).json({ message: "Failed to save uploaded file" });
    }

    const application = new Application({
      userId: req.user._id,
      jobId,
      fullName,
      email,
      phone,
      resume,
    });

    await application.save();
    console.log("Application saved:", application._id);
    res.status(201).json({ message: "Application submitted successfully! Mazze karo!" });
  } catch (error) {
    console.error("Error applying for job:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
      file: req.file,
    });
    res.status(500).json({ message: error.message || "Server error, bhai kuch gadbad ho gaya!" });
  }
});

// Other routes (unchanged for brevity)
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

router.get("/applications/:jobId", protect, admin, async (req, res) => {
  try {
    const applications = await Application.find({ jobId: req.params.jobId })
      .populate("userId", "fullName email rollNo phone receiveEmails")
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");
    res.json(applications);
  } catch (error) {
    console.error("Error fetching job applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/applications/:id", protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const application = await Application.findById(req.params.id)
      .populate("userId", "fullName email rollNo phone receiveEmails")
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");

    if (!application) return res.status(404).json({ message: "Application not found" });

    if (application.status !== status) {
      application.status = status;
      const updatedApplication = await application.save();

      if (application.userId.receiveEmails) {
        try {
          const recipientId = application.userId._id;
          const frontendUrl = process.env.FRONTEND_URL || "https://campusconnectkrmu.onrender.com";
          const subject = `Application Status Update: ${application.jobId.profiles} at ${application.jobId.companyName}`;
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #2c3e50;">Application Status Update</h2>
              <p style="font-size: 16px; color: #34495e;">Dear ${application.userId.fullName},</p>
              <p style="font-size: 16px; color: #34495e;">Your application for the following job has been updated:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Company:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${application.jobId.companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Position:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${application.jobId.profiles}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">New Status:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${status}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Applied Date:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${new Date(application.appliedDate).toLocaleDateString()}</td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #7f8c8d;">${
                status === "Scheduled" ? "Please check the Campus Connect portal for interview details." :
                status === "Accepted" ? "Congratulations! Please follow up for next steps." :
                status === "Rejected" ? "Thank you for applying. Keep exploring other opportunities." :
                "Your application is under review."
              }</p>
              <a href="${frontendUrl}/my-applications" 
                 style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                View Application
              </a>
              <p style="font-size: 12px; color: #bdc3c7; margin-top: 20px;">
                This email was sent by Campus Connect. 
                <a href="${frontendUrl}/unsubscribe?email={{recipient.email}}">Unsubscribe</a>
              </p>
            </div>
          `;

          const emailResult = await emailService.sendBulkEmail(
            req.user._id,
            [recipientId],
            subject,
            htmlContent,
            [],
            { trackOpens: true }
          );

          console.log(`Email sent to student ${application.userId.email} for application ${application._id} status update to ${status}. Campaign ID: ${emailResult.campaignId}`);
        } catch (emailError) {
          console.error("Error sending status update email:", emailError);
        }
      }

      res.json(updatedApplication);
    } else {
      res.json(application);
    }
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Server error" });
  }
});

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

module.exports = router;