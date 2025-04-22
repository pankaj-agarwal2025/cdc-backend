const mongoose = require("mongoose");

const VerificationTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: "15m" }, // Expires in 15 minutes
});

module.exports = mongoose.model("VerificationToken", VerificationTokenSchema);