const User = require("../models/User");
const bcrypt = require('bcryptjs'); // Ensure bcryptjs is installed: npm install bcryptjs

// Get all users (with optional filters for admin)
const getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = {};
    
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query).select('-password'); // Exclude password from response
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error while fetching user" });
  }
};

// Update user (admin can update any user)
const updateUser = async (req, res) => {
  try {
    const { fullName, email, role, mobileNo, whatsappNo, rollNo, status } = req.body

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const updatedRole = role || user.role
    if (updatedRole === "student" && !rollNo) {
      return res.status(400).json({ message: "Roll number is required for student users" })
    }

    if (fullName) user.fullName = fullName
    if (email) user.email = email
    if (role) user.role = role
    if (mobileNo) user.mobileNo = mobileNo
    if (whatsappNo) user.whatsappNo = whatsappNo
    if (rollNo && updatedRole === "student") user.rollNo = rollNo

    // Add this line to update the status field
    if (status) user.status = status

    const updatedUser = await user.save()
    res.json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status, // Include status in the response
      mobileNo: updatedUser.mobileNo,
      whatsappNo: updatedUser.whatsappNo,
      rollNo: updatedUser.rollNo,
      createdAt: updatedUser.createdAt,
    })
  } catch (error) {
    console.error("Error updating user:", error)
    if (error.code === 11000) {
      if (error.keyPattern.rollNo) {
        return res.status(400).json({ message: `Roll number '${error.keyValue.rollNo}' is already in use` })
      }
      if (error.keyPattern.email) {
        return res.status(400).json({ message: `Email '${error.keyValue.email}' is already in use` })
      }
    }
    res.status(500).json({ message: "Server error while updating user" })
  }
}



// Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error while deleting user" });
  }
};

// Change user role
const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['student', 'admin', 'staff'].includes(role)) {
      return res.status(400).json({ message: "Invalid role provided" });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    user.role = role;
    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt // Include createdAt for consistency
    });
  } catch (error) {
    console.error("Error changing user role:", error);
    res.status(500).json({ message: "Server error while changing user role" });
  }
};

// Get user statistics for admin dashboard
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const pendingApprovals = await User.countDocuments({ status: 'pending' }); // Adjust if 'pending' isn’t used
    
    res.json({
      totalUsers,
      activeUsers,
      pendingApprovals
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Server error while fetching user statistics" });
  }
};

// Create a new user
const createUser = async (req, res) => {
    try {
      const { fullName, email, password, mobileNo, role, status, rollNo } = req.body;
      
      if (!fullName || !email || !password || !role) {
        return res.status(400).json({ message: 'Full name, email, password, and role are required' });
      }
      
      if (role === 'student' && !rollNo) {
        return res.status(400).json({ message: 'Roll number is required for student users' });
      }
      
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const user = await User.create({
        fullName,
        email,
        password: hashedPassword,
        mobileNo,
        role,
        status: status || 'active',
        rollNo: role === 'student' ? rollNo : undefined
      });
      
      res.status(201).json({
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mobileNo: user.mobileNo,
        status: user.status,
        rollNo: user.rollNo,
        createdAt: user.createdAt
      });
    } catch (error) {
      console.error("Error creating user:", error);
      if (error.code === 11000) {
        // Handle duplicate key error
        if (error.keyPattern.rollNo) {
          return res.status(400).json({ message: `Roll number '${error.keyValue.rollNo}' is already in use` });
        }
        if (error.keyPattern.email) {
          return res.status(400).json({ message: `Email '${error.keyValue.email}' is already in use` });
        }
      }
      res.status(500).json({ message: "Server error while creating user", error: error.message });
    }
  };
  
 
module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changeUserRole,
  getUserStats,
  createUser
};