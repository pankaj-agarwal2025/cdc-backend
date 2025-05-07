const express = require("express");
const router = express.Router();
const InterviewExperience = require("../models/InterviewExperience");
const authMiddleware = require("../middleware/authMiddleware");
const { staffOrAdmin } = require("../middleware/authMiddleware");

// Public endpoint: Submit an interview experience
router.post("/", async (req, res) => {
  try {
    const { companyName, role, author, batch, course, interviewLocation, offerStatus, experienceRating, difficulty, rounds } = req.body;

    // Basic validation
    if (!companyName || !role || !author || !batch || !course || !interviewLocation || !offerStatus || !experienceRating || !difficulty || !rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return res.status(400).json({ message: "All fields are required, and rounds must be a non-empty array" });
    }

    const experience = new InterviewExperience({
      companyName,
      role,
      author,
      batch,
      course,
      interviewLocation,
      offerStatus,
      experienceRating,
      difficulty,
      rounds,
      status: "Approved", // Directly approved
    });

    await experience.save();
    res.status(201).json({ message: "Interview experience submitted successfully." });
  } catch (error) {
    console.error("Error submitting interview experience:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Public endpoint: Get approved experiences (for InterviewInsights page)
router.get("/", async (req, res) => {
  try {
    const experiences = await InterviewExperience.find({ status: "Approved" });
    res.json(experiences);
  } catch (error) {
    console.error("Error fetching interview experiences:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin/staff: Get all experiences (for management)
router.get("/manage", authMiddleware.protect, staffOrAdmin, async (req, res) => {
  try {
    const experiences = await InterviewExperience.find();
    res.json(experiences);
  } catch (error) {
    console.error("Error fetching interview experiences for management:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin/staff: Get stats for interview experiences
router.get("/stats", authMiddleware.protect, staffOrAdmin, async (req, res) => {
  try {
    const totalExperiences = await InterviewExperience.countDocuments();
    res.json({ totalExperiences });
  } catch (error) {
    console.error("Error fetching interview experience stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin/staff: Update an experience
router.patch("/:id", authMiddleware.protect, staffOrAdmin, async (req, res) => {
  try {
    const { companyName, role, author, batch, course, interviewLocation, offerStatus, experienceRating, difficulty, rounds } = req.body;

    // Basic validation
    if (!companyName || !role || !author || !batch || !course || !interviewLocation || !offerStatus || !experienceRating || !difficulty || !rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return res.status(400).json({ message: "All fields are required, and rounds must be a non-empty array" });
    }

    const experience = await InterviewExperience.findById(req.params.id);
    if (!experience) {
      return res.status(404).json({ message: "Interview experience not found" });
    }

    experience.companyName = companyName;
    experience.role = role;
    experience.author = author;
    experience.batch = batch;
    experience.course = course;
    experience.interviewLocation = interviewLocation;
    experience.offerStatus = offerStatus;
    experience.experienceRating = experienceRating;
    experience.difficulty = difficulty;
    experience.rounds = rounds;
    experience.updatedAt = Date.now();

    await experience.save();
    res.json({ message: "Interview experience updated successfully.", experience });
  } catch (error) {
    console.error("Error updating interview experience:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin/staff: Delete an experience
router.delete("/:id", authMiddleware.protect, staffOrAdmin, async (req, res) => {
  try {
    const experience = await InterviewExperience.findByIdAndDelete(req.params.id);
    if (!experience) {
      return res.status(404).json({ message: "Interview experience not found" });
    }
    res.json({ message: "Interview experience deleted" });
  } catch (error) {
    console.error("Error deleting interview experience:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;