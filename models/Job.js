const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true },
    officeAddress: { type: String, required: true },
    website: { type: String, required: true },
    yearOfEstablishment: { type: Number, required: true },
    contactPersonName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    email: { type: String, required: true },
    profiles: { type: String, required: true },
    eligibility: { type: String, required: true },
    vacancies: { type: Number, required: true },
    offerType: {
      type: [String], // Changed to array
      enum: ["Full time Employment", "Internship + PPO", "Apprenticeship", "Summer Internship"],
      required: true, // Ensures the array is not empty
    },
    ctcOrStipend: { type: String, required: true },
    location: { type: String, required: true },
    resultDeclaration: {
      type: String,
      enum: ["Same day", "Within a week","within a month", "after a month"],
      required: true,
    },
    dateOfJoining: { type: Date, required: true },
    reference: {
      type: String,
      enum: ["Dr. Vibha Thakur", "Ms. Shruti Bansal", "Ms. Mansi Shrivastava", "Ms. Charu Gola", "Self"],
      required: true,
    },
    skills: {
      type: [String],
      required: true,
    },
    category: {
      type: [String],
      required: true,
    },
    jobDescription: { type: String },
    companyLogo: { type: String },
    additionalInfo: { type: String },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    postedBy: { type: String },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

JobSchema.pre("save", function (next) {
  if (this.reference === "Self") {
    this.postedBy = this.contactPersonName;
  } else {
    this.postedBy = this.reference;
  }
  next();
});

module.exports = mongoose.model("Job", JobSchema);