const express = require("express");
const multer = require("multer");
const { protect, admin } = require("../middleware/authMiddleware");
const Application = require("../models/Application");
const Job = require("../models/Job");
const emailService = require("../services/emailService");

const router = express.Router();

// Multer setup for resume upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "Uploads/"),
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

    const resume = `/Uploads/${req.file.filename}`;
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
    const application = await Application.findById(req.params.id)
      .populate("userId", "fullName email rollNo phone")
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");

    if (!application) return res.status(404).json({ message: "Application not found" });

    // Check if status is changing
    if (application.status !== status) {
      application.status = status;
      const updatedApplication = await application.save();

      // Send email notification to the student
      try {
        const recipientId = application.userId._id;
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
            <a href="${process.env.FRONTEND_URL}/my-applications" 
               style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
              View Application
            </a>
            <p style="font-size: 12px; color: #bdc3c7; margin-top: 20px;">
              This email was sent by Campus Connect. 
              <a href="${process.env.FRONTEND_URL}/unsubscribe?email={{recipient.email}}">Unsubscribe</a>
            </p>
          </div>
        `;

        const emailResult = await emailService.sendBulkEmail(
          req.user._id, // Sender (admin)
          [recipientId], // Single recipient (student)
          subject,
          htmlContent,
          [], // No attachments
          { trackOpens: true } // Enable open tracking
        );

        console.log(`Email sent to student ${application.userId.email} for application ${application._id} status update to ${status}. Campaign ID: ${emailResult.campaignId}`);
      } catch (emailError) {
        console.error("Error sending status update email:", emailError);
        // Do not fail the status update if email sending fails
      }

      res.json(updatedApplication);
    } else {
      res.json(application); // No status change, return original application
    }
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

// Get my applications (for students)
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