// controllers/profileController.js
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;

// Get Profile
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
      profilePhoto: user.profilePhoto || null,
      resume: user.resume || null,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json(mappedUser);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper to process form data
const processProfileData = async (req) => {
  try {
    const updateFields = { ...req.body };

    // Parse JSON fields
    ['education', 'experience', 'certifications', 'skills'].forEach(field => {
      if (updateFields[field]) {
        try {
          updateFields[field] = JSON.parse(updateFields[field]);
          if (field === 'experience' && !Array.isArray(updateFields[field])) {
            updateFields[field] = [updateFields[field]];
          }
        } catch (err) {
          console.error(`Error parsing ${field} data:`, err);
          throw new Error(`Invalid ${field} data format`);
        }
      }
    });

    // Handle boolean fields
    if (updateFields.readyToRelocate) {
      updateFields.readyToRelocate = updateFields.readyToRelocate === "true" || updateFields.readyToRelocate === true;
    }

    // Process experience
    if (Array.isArray(updateFields.experience)) {
      updateFields.experience = updateFields.experience.map(exp => ({
        ...exp,
        hasExperience: exp.hasExperience === true || exp.hasExperience === "true",
      }));
    }

    // Handle profile photo upload to Cloudinary
    if (req.files?.profilePhoto) {
      const file = req.files.profilePhoto[0];
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "image", folder: "campusconnect/profiles" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        ).end(file.buffer);
      });
      updateFields.profilePhoto = result.secure_url;
    }

    // Handle resume upload to Cloudinary
    if (req.files?.resume) {
      const file = req.files.resume[0];
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "campusconnect/resumes", format: "pdf" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        ).end(file.buffer);
      });
      updateFields.resume = result.secure_url;
    }

    // Handle certification images upload to Cloudinary
    if (updateFields.certifications && Array.isArray(updateFields.certifications)) {
      const processedCertifications = [];

      for (let i = 0; i < updateFields.certifications.length; i++) {
        const cert = {
          name: updateFields.certifications[i].name || "",
          image: updateFields.certifications[i].image || "",
        };

        const certFileKey = `certificationImage-${i}`;
        if (req.files[certFileKey]) {
          const file = req.files[certFileKey][0];
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { resource_type: "image", folder: "campusconnect/certifications" },
              (error, result) => {
                if (error) return reject(error);
                resolve(result);
              }
            ).end(file.buffer);
          });
          cert.image = result.secure_url;
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

// Complete Profile
exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateFields = await processProfileData(req);

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
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error in completeProfile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateFields = await processProfileData(req);

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
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Upload Profile Photo
// In profileController.js
exports.uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user._id;
    const file = req.file;

    const user = await User.findById(userId);
    if (user.profilePhoto) {
      await deleteCloudinaryFile(user.profilePhoto);
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "image", folder: "campusconnect/profiles" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      ).end(file.buffer);
    });

    const profilePhoto = result.secure_url;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto },
      { new: true }
    );

    res.status(200).json({ message: "Profile photo uploaded", profilePhoto });
  } catch (error) {
    console.error("Error uploading profile photo:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.uploadResume = async (req, res) => {
  try {
    const userId = req.user._id;
    const file = req.file;

    const user = await User.findById(userId);
    if (user.resume) {
      await deleteCloudinaryFile(user.resume);
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "raw", folder: "campusconnect/resumes", format: "pdf" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      ).end(file.buffer);
    });

    const resume = result.secure_url;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { resume },
      { new: true }
    );

    res.status(200).json({ message: "Resume uploaded", resume });
  } catch (error) {
    console.error("Error uploading resume:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};