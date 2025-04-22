const multer = require("multer");
const path = require("path");

// Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Files will be stored in 'uploads' folder
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File Filter (Only allow PDFs & images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PDF, JPG, and PNG are allowed."), false);
  }
};

// Upload Config
const upload = multer({ storage, fileFilter });

module.exports = upload;
