const express = require("express");
const multer = require("multer");
const { protect, admin } = require("../middleware/authMiddleware");
const Application = require("../models/Application");
const Job = require("../models/Job");
const emailService = require("../services/emailService");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const XLSX = require("xlsx");

const router = express.Router();

// Configure multer to store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, DOCX files are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// Apply for a job
router.post(
  "/",
  protect,
  upload.single("resume"),
  handleMulterError,
  async (req, res) => {
    try {
      const { jobId, fullName, email, phone } = req.body;
      if (!jobId || !fullName || !email || !phone || !req.file) {
        return res
          .status(400)
          .json({ message: "Missing required fields: jobId, fullName, email, phone, or resume" });
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

      const existingApplication = await Application.findOne({
        userId: req.user._id,
        jobId,
      });
      if (existingApplication) {
        console.error("Duplicate application:", { userId: req.user._id, jobId });
        return res
          .status(400)
          .json({ message: "You have already applied for this job" });
      }

      // Upload resume to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: "raw",
            folder: "campusconnect/resumes",
            format: "pdf",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      const resumeUrl = result.secure_url;

      const application = new Application({
        userId: req.user._id,
        jobId,
        fullName,
        email,
        phone,
        resume: resumeUrl,
        status: "Applied",
        appliedDate: new Date(),
      });

      await application.save();
      res.status(201).json({ message: "Application submitted successfully!" });
    } catch (error) {
      console.error("Error applying for job:", {
        message: error.message,
        stack: error.stack,
        body: req.body,
        file: req.file,
      });
      res.status(500).json({ message: error.message || "Server error" });
    }
  }
);

// Get jobs for application management
router.get("/jobs", protect, admin, async (req, res) => {
  try {
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .select("_id companyName profiles location ctcOrStipend status")
      .lean();
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

// Get applications for a specific job
router.get("/applications/:jobId", protect, admin, async (req, res) => {
  try {
    const applications = await Application.find({ jobId: req.params.jobId })
      .populate("userId", "fullName email phone rollNo receiveEmails")
      .populate("jobId", "profiles companyName ctcOrStipend location offerType");
    res.json(applications);
  } catch (error) {
    console.error("Error fetching job applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update application status
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

      if (application.userId && application.userId.receiveEmails) {
        try {
          const recipientId = application.userId._id;
          const frontendUrl = process.env.FRONTEND_URL || "https://campusconnectkrmu.onrender.com";
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
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${new Date(
                    application.appliedDate
                  ).toLocaleDateString()}</td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #7f8c8d;">${
                status === "Scheduled"
                  ? "Please check the Campus Connect portal for interview details."
                  : status === "Accepted"
                  ? "Congratulations! Please follow up for next steps."
                  : status === "Rejected"
                  ? "Thank you for applying. Keep exploring other opportunities."
                  : "Your application is under review."
              }</p>
              <a href="${frontendUrl}/my-applications" 
                 style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                View Application
              </a>
              <p style="font-size: 12px; color: #bdc3c7; margin-top: 20px;">
                This email was sent by Campus Connect. 
                <a href="${frontendUrl}/unsubscribe?email=${encodeURIComponent(
                  application.userId.email
                )}">Unsubscribe</a>
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

// Download resume
router.get("/resume/:applicationId", protect, async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId).populate("userId", "fullName email");
    if (!application) {
      console.error(`Application not found: ${req.params.applicationId}`);
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.userId?.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      console.error(`Unauthorized access to application: ${req.params.applicationId} by user: ${req.user._id}`);
      return res.status(403).json({ message: "Not authorized" });
    }

    if (!application.resume) {
      console.error(`No resume found for application: ${req.params.applicationId}`);
      return res.status(404).json({ message: "No resume found" });
    }

    const resumeUrl = application.resume.replace(/\/upload\//, "/upload/fl_attachment/");

    const response = await axios.get(resumeUrl, { responseType: "stream" });
    const contentType = response.headers["content-type"] || "application/pdf";
    if (!contentType.includes("pdf")) {
      console.error(`Invalid content type for resume: ${contentType}, URL: ${resumeUrl}`);
      return res.status(400).json({ message: "Invalid resume file type" });
    }

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="resume-${application._id}.pdf"`,
    });

    response.data.pipe(res);
  } catch (error) {
    console.error(`Error downloading resume for application ${req.params.applicationId}:`, {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : null,
    });
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

// Delete application
router.delete("/applications/:id", protect, admin, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.resume) {
      const publicId = application.resume.split("/").slice(-1)[0].split(".")[0];
      await cloudinary.uploader.destroy(`campusconnect/resumes/${publicId}`, {
        resource_type: "raw",
      });
    }

    await Application.findByIdAndDelete(req.params.id);
    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get user's applications
router.get("/my-applications", protect, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user._id }).populate({
      path: "jobId",
      select: "profiles companyName ctcOrStipend location offerType",
    });

    const processedApplications = applications.map((app) => {
      if (!app.jobId) {
        return {
          ...app.toObject(),
          jobId: {
            profiles: "Position Removed",
            companyName: "Company Removed",
            ctcOrStipend: "N/A",
            location: "N/A",
            offerType: [],
          },
        };
      }
      return app;
    });

    res.json(processedApplications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Server-side Excel export
router.get("/export/:jobId", protect, admin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = { jobId: req.params.jobId };
    if (status) query.status = status;

    const applications = await Application.find(query)
      .populate("userId", "fullName email phone rollNo")
      .populate("jobId", "companyName profiles");

    if (applications.length === 0) {
      return res.status(400).json({ message: "No applications to export" });
    }


    const tableData = applications.map(app => ({
      Name: app.userId?.fullName || app.fullName || "N/A",
      Email: app.email || app.userId?.email || "N/A",
      Mobile: app.phone || app.userId?.phone || "N/A",
      Resume: app.resume || "Not uploaded",
      "Applied Date": new Date(app.appliedDate).toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    const worksheet = XLSX.utils.json_to_sheet(tableData, {
      header: ["Name", "Email", "Mobile", "Resume", "Applied Date"],
      skipHeader: false,
    });

    const companyName = applications[0]?.jobId?.companyName || "Unknown";
    XLSX.utils.sheet_add_aoa(worksheet, [[`Company: ${companyName}`], [""]], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    worksheet["A1"].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center", vertical: "center" },
    };
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 50 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applications");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    res.set({
      "Content-Disposition": `attachment; filename="${companyName}_${applications[0]?.jobId?.profiles || "Job"}_Applications.xlsx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    res.send(buffer);
  } catch (error) {
    console.error("Error exporting applications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;