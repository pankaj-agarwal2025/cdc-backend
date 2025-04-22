const User = require("../models/User");

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let experiences = user.experience || [];
    if (!Array.isArray(experiences) || experiences.length === 0) {
      experiences = [{
        hasExperience: false,
        organizationName: "",
        duration: "",
        details: "",
      }];
    }

    const mappedUser = {
      _id: user._id,
      fullName: user.fullName || "",
      email: user.email || "",
      rollNo: user.rollNo || "",
      mobileNo: user.mobileNo || "",
      whatsappNo: user.whatsappNo || "",
      mailId: user.mailId || "",
      fatherName: user.fatherName || "",
      fatherNumber: user.fatherNumber || "",
      school: user.school || "",
      existingBacklogs: user.existingBacklogs || "",
      areaOfInterest: user.areaOfInterest || "",
      readyToRelocate: user.readyToRelocate || false,
      education: user.education || {
        tenth: { percentage: "", passingYear: "" },
        twelfth: { percentage: "", passingYear: "" },
        graduation: { degree: "", percentageOrCGPA: "", passingYear: "" },
        masters: { degree: "", percentageOrCGPA: "", passingYear: "" },
      },
      certifications: user.certifications || [],
      skills: user.skills || [],
      experience: experiences,
      profilePhoto: user.profilePhoto ? user.profilePhoto.replace(/^\/+/, '') : null, // Normalize path
      resume: user.resume || null,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json(mappedUser);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Helper to process form data
// -----------------------------
const processProfileData = (req) => {
  try {
    const updateFields = { ...req.body };

    ['education', 'experience', 'certifications', 'skills'].forEach(field => {
      if (updateFields[field]) {
        try {
          updateFields[field] = JSON.parse(updateFields[field]);

          if (field === 'experience' && !Array.isArray(updateFields[field])) {
            updateFields[field] = [updateFields[field]];
          }
        } catch (err) {
          console.error(`Error parsing ${field} data:`, err);
        }
      }
    });

    if (updateFields.readyToRelocate) {
      updateFields.readyToRelocate = updateFields.readyToRelocate === "true";
    }

    if (Array.isArray(updateFields.experience)) {
      updateFields.experience = updateFields.experience.map(exp => ({
        ...exp,
        hasExperience: exp.hasExperience === true || exp.hasExperience === "true"
      }));
    }

    // 🔧 PROFILE PHOTO HANDLING (updated)
    if (req.files) {
      if (req.files.profilePhoto) {
        updateFields.profilePhoto = `uploads/${req.files.profilePhoto[0].filename}`;
      }
    }

    if (!updateFields.profilePhoto && req.body.profilePhoto) {
      const rawPath = req.body.profilePhoto;

      const cleanedPath = rawPath
        .replace(/^\/?api\//, "")             // remove /api/ prefix
        .replace(/^https?:\/\/[^/]+\/?/, "") // remove domain
        .replace(/^\/+/, "");                // remove leading slashes

      updateFields.profilePhoto = cleanedPath;
    }

    if (req.files?.resume) {
      updateFields.resume = `uploads/${req.files.resume[0].filename}`;
    }

    if (updateFields.certifications && Array.isArray(updateFields.certifications)) {
      const processedCertifications = [];

      for (let i = 0; i < updateFields.certifications.length; i++) {
        const cert = {
          name: updateFields.certifications[i].name,
          image: updateFields.certifications[i].image || ""
        };

        const certFileKey = `certificationImage-${i}`;
        if (req.files[certFileKey]) {
          cert.image = `uploads/${req.files[certFileKey][0].filename}`;
        }

        processedCertifications.push(cert);
      }

      updateFields.certifications = processedCertifications;
    }

    return updateFields;
  } catch (error) {
    console.error("Error processing profile data:", error);
    throw error;
  }
};

// -----------------------------
// Complete Profile
// -----------------------------
exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateFields = processProfileData(req);

    if (updateFields.experience?.length === 1 && !updateFields.experience[0].hasExperience) {
      updateFields.experience = [{
        hasExperience: false,
        organizationName: "",
        duration: "",
        details: "",
      }];
    } else {
      updateFields.experience = updateFields.experience.filter(exp => exp.hasExperience);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error in completeProfile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Update Profile
// -----------------------------
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateFields = processProfileData(req);

    if (updateFields.experience?.length === 1 && !updateFields.experience[0].hasExperience) {
      updateFields.experience = [{
        hasExperience: false,
        organizationName: "",
        duration: "",
        details: "",
      }];
    } else {
      updateFields.experience = updateFields.experience.filter(exp => exp.hasExperience);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// -----------------------------
// Upload Profile Photo
// -----------------------------
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user._id;
    const profilePhoto = `uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePhoto },
      { new: true }
    );

    res.status(200).json({ message: "Profile photo uploaded", profilePhoto });
  } catch (error) {
    console.error("Error uploading profile photo:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------
// Upload Resume
// -----------------------------
exports.uploadResume = async (req, res) => {
  try {
    const userId = req.user._id;
    const resume = `uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { resume },
      { new: true }
    );

    res.status(200).json({ message: "Resume uploaded", resume });
  } catch (error) {
    console.error("Error uploading resume:", error);
    res.status(500).json({ message: "Server error" });
  }
};
