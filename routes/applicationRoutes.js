const express = require("express");
const multer = require("multer");
const { protect, admin } = require("../middleware/authMiddleware");
const Application = require("../models/Application");
const Job = require("../models/Job");
const emailService = require("../services/emailService");
const { MongoClient, GridFSBucket } = require("mongodb");
const { Readable } = require("stream");

const router = express.Router();

// Configure multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
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

// Initialize MongoDB connection and GridFS
let gfsBucket;
const initGridFS = async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db("campusconnect"); 
  gfsBucket = new GridFSBucket(db, { bucketName: "resumes" });
  console.log("GridFS initialized");
};
initGridFS().catch((err) => console.error("GridFS initialization failed:", err));

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

    // Upload resume to GridFS
    const filename = `${Date.now()}-${req.file.originalname}`;
    const readableStream = Readable.from(req.file.buffer);
    const uploadStream = gfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });

    await new Promise((resolve, reject) => {
      readableStream.pipe(uploadStream)
        .on("error", (error) => {
          console.error("GridFS upload error:", error);
          reject(error);
        })
        .on("finish", () => {
          console.log("File uploaded to GridFS:", filename);
          resolve();
        });
    });

    const application = new Application({
      userId: req.user._id,
      jobId,
      fullName,
      email,
      phone,
      resume: filename, // Store GridFS filename
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

// Route to download resume
router.get("/resume/:filename", async (req, res) => {
  try {
    if (!gfsBucket) {
      throw new Error("GridFS not initialized");
    }

    const filename = req.params.filename;
    const downloadStream = gfsBucket.openDownloadStreamByName(filename);

    downloadStream.on("error", (error) => {
      console.error("Error downloading file:", error);
      res.status(404).json({ message: "File not found" });
    });

    res.set("Content-Type", "application/pdf"); // Adjust based on file type
    downloadStream.pipe(res);
  } catch (error) {
    console.error("Error retrieving resume:", error);
    res.status(500).json({ message: error.message || "Server error" });
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

      // Check if user exists and if they want to receive emails
      if (application.userId && application.userId.receiveEmails) {
        try {
          const recipientId = application.userId._id;
          const frontendUrl = process.env.FRONTEND_URL || "https://campusconnectkrmu.onrender.com";
          
          // Add null checks for job information
          const jobTitle = application.jobId?.profiles || "this position";
          const companyName = application.jobId?.companyName || "the company";
          
          const subject = `Application Status Update: ${jobTitle} at ${companyName}`;
          
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #2c3e50;">Application Status Update</h2>
              <p style="font-size: 16px; color: #34495e;">Dear ${application.userId.fullName},</p>
              <p style="font-size: 16px; color: #34495e;">Your application for the following job has been updated:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Company:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Position:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${jobTitle}</td>
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
                <a href="${frontendUrl}/unsubscribe?email=${encodeURIComponent(application.userId.email)}">Unsubscribe</a>
              </p>
            </div>
          `;

          // Check if emailService is properly initialized before using it
          if (!emailService || typeof emailService.sendBulkEmail !== 'function') {
            throw new Error("Email service not properly initialized");
          }

          const emailResult = await emailService.sendBulkEmail(
            req.user._id,
            [recipientId],
            subject,
            htmlContent,
            [],
            { trackOpens: true }
          );

          console.log(`Email sent to student ${application.userId.email} for application ${application._id} status update to ${status}. Campaign ID: ${emailResult?.campaignId || 'unknown'}`);
        } catch (emailError) {
          console.error("Error sending status update email:", emailError);
          // Send response even if email fails
        }
      } else {
        console.log(`Email not sent for application ${application._id}: User preference set to not receive emails or user not found`);
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
      .populate({
        path: "jobId",
        select: "profiles companyName ctcOrStipend location offerType"
      });
      
    // Filter out applications with null jobId or add a placeholder
    const processedApplications = applications.map(app => {
      if (!app.jobId) {
        // Option 1: Create a placeholder for deleted jobs
        return {
          ...app.toObject(),
          jobId: {
            profiles: "Position Removed",
            companyName: "Company Removed",
            ctcOrStipend: "N/A",
            location: "N/A",
            offerType: []
          }
        };
        
        // Option 2: Or just return as is (and handle in frontend)
        // return app;
      }
      return app;
    });
    
    res.json(processedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;