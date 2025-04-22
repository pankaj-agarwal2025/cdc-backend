const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  resume: { type: String, required: true }, 
  status: {
    type: String,
    enum: ["Applied", "Scheduled", "Rejected", "Accepted"],
    default: "Applied",
  },
  appliedDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Application", ApplicationSchema);