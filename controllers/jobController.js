const Job = require("../models/Job");
const User = require("../models/User");
const emailService = require("../services/emailService");

exports.createJob = async (req, res) => {
  try {
    // Check if user is admin - for authenticated users
    const isAdmin= req.user && (req.user.role === "admin");
    
    // Create job data with proper status and posted by info
    const jobData = {
      ...req.body,
      status: isAdmin? "approved" : "pending",
      // Use contact person name for unauthenticated users
      postedBy: req.user ? req.user.name : req.body.contactPersonName,
    };

    const newJob = new Job(jobData);
    const savedJob = await newJob.save();

    // If job is approved, send email to all students
    if (savedJob.status === "approved") {
      try {
        // Fetch all active students
        const students = await User.find({ role: "student", status: "active" }, "_id email");
        const recipientIds = students.map((student) => student._id);

        if (recipientIds.length > 0) {
          // Define email content
          const subject = `New Job Opportunity: ${savedJob.profiles} at ${savedJob.companyName}`;
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #2c3e50;">New Job Opportunity!</h2>
              <p style="font-size: 16px; color: #34495e;">A new job has been posted on Campus Connect that might interest you. Here are the details:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Company:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${savedJob.companyName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Position:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${savedJob.profiles}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Salary/Stipend:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${savedJob.ctcOrStipend}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e0e0e0;">Skills Required:</td>
                  <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${savedJob.skills.join(", ")}</td>
                </tr>
              </table>
              <p style="font-size: 14px; color: #7f8c8d;">To view more details and apply, visit the Campus Connect portal.</p>
              <a href="${process.env.FRONTEND_URL}/jobs/${savedJob._id}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                View Job
              </a>
              <p style="font-size: 12px; color: #bdc3c7; margin-top: 20px;">
                This email was sent by Campus Connect. 
                <a href="${process.env.FRONTEND_URL}/unsubscribe?email={{recipient.email}}">Unsubscribe</a>
              </p>
            </div>
          `;

          // Send bulk email
          const emailResult = await emailService.sendBulkEmail(
            req.user ? req.user._id : null, // Sender ID (can be null for unauthenticated)
            recipientIds, // Recipient IDs
            subject,
            htmlContent,
            [], // No attachments
            { trackOpens: true } // Enable open tracking
          );

        } else {
          console.log("No active students found to send email notifications.");
        }
      } catch (emailError) {
        console.error("Error sending email notifications to students:", emailError);
        // Do not fail the job creation if email sending fails
      }
    }

    res.status(201).json({
      success: true,
      data: savedJob,
      message: `Job created successfully, status: ${savedJob.status}`,
    });
  } catch (error) {
    console.error("Error creating job:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    res.status(400).json({
      success: false,
      message: error.message || "Failed to create job",
    });
  }
};


exports.getPublicJobs = async (req, res) => {
  try {
    const { profiles, offerType, location, skills, category } = req.query;
    const filters = { status: "approved" };

    // Apply filters if provided
    if (profiles) {
      filters.profiles = { $regex: profiles, $options: "i" }; // Case-insensitive
    }
    if (offerType) {
      filters.offerType = { $regex: offerType, $options: "i" }; // Case-insensitive
    }
    if (location) {
      filters.location = { $regex: location, $options: "i" }; // Case-insensitive
    }
    if (skills) {
      const skillsArray = skills.split(",").map((skill) => new RegExp(skill.trim(), "i"));
      filters.skills = { $in: skillsArray };
    }
    if (category) {
      const categoryArray = category.split(",").map((cat) => cat.trim());
      filters.category = { $in: categoryArray };
    }

    const jobs = await Job.find(filters).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    console.error("Error fetching public jobs:", error.stack); // Log full error for debugging
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
exports.getAllJobsAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied. Admin privileges required." });
    }
    const { profiles, offerType, location, status, skills, category, search, companyName } = req.query;
    const filters = {};
    if (status && status !== 'all') filters.status = status;
    if (offerType) filters.offerType = offerType;
    if (location) filters.location = new RegExp(location, 'i');
    if (companyName) filters.companyName = new RegExp(companyName, 'i');
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filters.$or = [
        { companyName: searchRegex },
        { profiles: searchRegex },
        { postedBy: searchRegex },
        { location: searchRegex },
      ];
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        filters.$or.push({ _id: search });
      }
    } else if (profiles) {
      filters.profiles = new RegExp(profiles, 'i');
    }
    if (skills) {
      const skillsArray = skills.split(',').map(skill => new RegExp(skill.trim(), 'i'));
      filters.skills = { $in: skillsArray };
    }
    if (category) {
      const categoryArray = category.split(',').map(cat => cat.trim());
      filters.category = { $in: categoryArray };
    }
    const jobs = await Job.find(filters).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    if (job.status !== "approved" && (!req.user || !req.user.isAdmin)) {
      return res.status(403).json({ success: false, message: "Access denied. Only approved jobs can be viewed." });
    }
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateJob = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied. Admin privileges required." });
    }
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ success: true, data: updatedJob, message: "Job updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied. Admin privileges required." });
    }
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    await Job.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied. Admin privileges required." });
    }
    const { status } = req.body;
    if (!status || !["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    job.status = status;
    await job.save();
    res.status(200).json({ success: true, data: job, message: `Job status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobsByPostedBy = async (req, res) => {
  try {
    const { postedBy } = req.params;
    const { skills, category } = req.query;
    const filters = { postedBy };
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      filters.skills = { $in: skillsArray };
    }
    if (category) {
      const categoryArray = category.split(',').map(cat => cat.trim());
      filters.category = { $in: categoryArray };
    }
    if (req.user && req.user.isAdmin) {
      const jobs = await Job.find(filters).sort({ createdAt: -1 });
      return res.status(200).json({ success: true, count: jobs.length, data: jobs });
    }
    filters.status = "approved";
    const jobs = await Job.find(filters).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchJobsBySkills = async (req, res) => {
  try {
    const { skills } = req.query;
    if (!skills) return res.status(400).json({ success: false, message: "Skills parameter is required" });
    const skillsArray = skills.split(',').map(skill => new RegExp(skill.trim(), 'i'));
    const filters = { skills: { $in: skillsArray }, status: "approved" };
    if (req.user && req.user.isAdmin) delete filters.status;
    const jobs = await Job.find(filters).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchJobsByCategory = async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) return res.status(400).json({ success: false, message: "Category parameter is required" });
    const categoryArray = category.split(',').map(cat => cat.trim());
    const filters = { category: { $in: categoryArray }, status: "approved" };
    if (req.user && req.user.isAdmin) delete filters.status;
    const jobs = await Job.find(filters).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: jobs.length, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ status: "approved" });
    const expiredJobs = await Job.countDocuments({ status: "rejected" });
    res.json({
      totalJobs,
      activeJobs,
      expiredJobs,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching job statistics", error: error.message });
  }
};

exports.getApplicationStats = async (req, res) => {
  try {
    // Placeholder until Application model is implemented
    res.json({
      totalApplications: 0,
      pendingReview: 0,
      approved: 0,
      rejected: 0,
    });
  } catch (error) {
    console.error("Error fetching application stats:", error);
    res.status(500).json({ message: "Server error while fetching application statistics" });
  }
};