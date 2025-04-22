const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "admin", "staff"], default: "student" },
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "inactive" },
    rollNo: { type: String, sparse: true },
    mobileNo: { type: String },
    whatsappNo: { type: String },
    mailId: { type: String },
    fatherName: { type: String },
    fatherNumber: { type: String },
    school: { type: String },
    yearOfPassingKRMU: { type: String },
    courseAggregate: { type: String },
    education: {
      tenth: { percentage: String, passingYear: String },
      twelfth: { percentage: String, passingYear: String },
      graduation: { degree: String, percentageOrCGPA: String, passingYear: String },
      masters: { degree: String, percentageOrCGPA: String, passingYear: String },
    },
    existingBacklogs: { type: String },
    areaOfInterest: { type: String },
    skills: [{ name: String }],
    certifications: [{ name: String, image: String }],
    readyToRelocate: { type: Boolean, default: false },
    experience: [
      {
        hasExperience: { type: Boolean, default: false },
        organizationName: { type: String },
        duration: { type: String },
        details: { type: String },
      },
    ],
    resume: { type: String },
    profilePhoto: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);