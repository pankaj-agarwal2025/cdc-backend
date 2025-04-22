const Training = require("../models/trainings"); 

// Get all trainings
exports.getAllTrainings = async (req, res) => {
  try {
    const trainings = await Training.find().sort({ date: 1 });
    res.status(200).json(trainings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get a single training by ID
exports.getTrainingById = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ message: "Training not found" });
    }
    res.status(200).json(training);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Create a new training
exports.createTraining = async (req, res) => {
  try {
    const { title, description, date, duration, mode, registrationLink } = req.body;

    // Validate required fields
    if (!title || !description || !date || !duration || !mode || !registrationLink) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const training = new Training({
      title,
      description,
      date,
      duration,
      mode,
      registrationLink,
    });

    await training.save();
    res.status(201).json(training);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update a training by ID
exports.updateTraining = async (req, res) => {
  try {
    const { title, description, date, duration, mode, registrationLink } = req.body;

    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ message: "Training not found" });
    }

    // Update fields
    training.title = title || training.title;
    training.description = description || training.description;
    training.date = date || training.date;
    training.duration = duration || training.duration;
    training.mode = mode || training.mode;
    training.registrationLink = registrationLink || training.registrationLink;

    await training.save();
    res.status(200).json(training);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete a training by ID
exports.deleteTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({ message: "Training not found" });
    }

    await training.deleteOne(); // Updated: Use deleteOne() instead of remove()
    res.status(200).json({ message: "Training deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get training stats
exports.getTrainingStats = async (req, res) => {
  try {
    const totalTrainings = await Training.countDocuments();
    const upcomingTrainings = await Training.countDocuments({
      date: { $gte: new Date() },
    });
    res.status(200).json({
      totalTrainings,
      upcomingTrainings,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};