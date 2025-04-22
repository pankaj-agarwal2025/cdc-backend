const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
  },
  description: {
    type: String,
    required: [true, "Description is required"],
  },
  date: {
    type: Date,
    required: [true, "Date is required"],
  },
  duration: {
    type: String,
    required: [true, "Duration is required"],
  },
  mode: {
    type: String,
    required: [true, "Mode is required"],
  },
  registrationLink: {
    type: String,
    required: [true, "Registration link is required"],
  },
});

module.exports = mongoose.model("Training", trainingSchema);