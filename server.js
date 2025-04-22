require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDb = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const profileRoutes = require("./routes/profileRoutes");
const userRoutes = require("./routes/userRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const trainingRoutes = require("./routes/TrainingRoutes");
const emailRoutes = require("./routes/emailRoutes"); // Add email routes
const app = express();

app.use(
  cors({
    origin: [
      "https://campusconnectkrmu.vercel.app",
      "https://campusconnect-test.onrender.com",
      "https://campusconnectkrmu.onrender.com",
      "http://campusconnect-frontend.s3-website.eu-north-1.amazonaws.com",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static paths
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

// Route mounting
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/admin", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/trainings", trainingRoutes);
app.use("/api/email", emailRoutes); 

connectDb();

app.get("/", (req, res) => {
  res.send("server connected...");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));