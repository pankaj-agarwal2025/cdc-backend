const mongoose = require("mongoose");

const interviewExperienceSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  role: { type: String, required: true },
  author: { type: String, required: true },
  batch: { type: String, required: true },
  course: { type: String, required: true },
  interviewLocation: { type: String, required: true },
  offerStatus: { type: String, enum: ["No Offer", "Accepted", "Declined"], required: true },
  experienceRating: { type: String, enum: ["Amazing", "Neutral", "Bad"], required: true },
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
  postedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  rounds: [
    {
      name: { type: String, required: true },
      description: { type: String, required: true },
    },
  ],
});

module.exports = mongoose.model("InterviewExperience", interviewExperienceSchema);