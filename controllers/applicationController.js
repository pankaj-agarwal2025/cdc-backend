const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const emailService = require("../services/emailService");

exports.getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate("userId", "fullName email phone rollNo receiveEmails")
      .populate("jobId", "profiles companyName ctcOrStipend location skills");
    res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching all applications:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getApplicationsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`Fetching applications for job: ${jobId}`);
    const applications = await Application.find({ jobId })
      .populate("userId", "fullName email phone rollNo receiveEmails")
      .populate("jobId", "profiles companyName ctcOrStipend location skills");
    console.log(`Found ${applications.length} applications for job ${jobId}`, applications);
    res.status(200).json(applications);
  } catch (error) {
    console.error(`Error fetching applications for job ${req.params.jobId}:`, error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Applied", "Under Review", "Scheduled", "Accepted", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const application = await Application.findById(id)
      .populate("userId", "fullName email phone rollNo receiveEmails")
      .populate("jobId", "profiles companyName ctcOrStipend location skills");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const previousStatus = application.status;
    application.status = status;
    await application.save();

    if (previousStatus !== status && application.userId?.receiveEmails) {
      try {
        await emailService.sendApplicationStatusUpdate(req.user.id, application, status);
        console.log(`Status update email sent to ${application.userId.email} for application ${application._id}`);
      } catch (emailError) {
        console.error("Error sending status update email:", emailError);
      }
    }

    res.status(200).json(application);
  } catch (error) {
    console.error("Error updating application:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getJobsForApplications = async (req, res) => {
  try {
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .select("_id companyName profiles location ctcOrStipend status");
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error fetching jobs for application management:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = exports;