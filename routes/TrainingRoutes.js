const express = require("express");
const router = express.Router();
const trainingsController = require("../controllers/trainingsController");
const { protect, staffOrAdmin } = require("../middleware/authMiddleware");

// Routes for trainings
router.get("/", trainingsController.getAllTrainings); // Public
router.get("/stats", protect, staffOrAdmin, trainingsController.getTrainingStats); // Restricted to staff/admin
router.get("/:id", trainingsController.getTrainingById); // Public
router.post("/", protect, staffOrAdmin, trainingsController.createTraining); // Restricted to staff/admin
router.put("/:id", protect, staffOrAdmin, trainingsController.updateTraining); // Restricted to staff/admin
router.delete("/:id", protect, staffOrAdmin, trainingsController.deleteTraining); // Restricted to staff/admin

module.exports = router;