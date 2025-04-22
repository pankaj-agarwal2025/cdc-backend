const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to protect routes (Require login)
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.toLowerCase().startsWith("bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      req.user.isAdmin = req.user.role === "admin";
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired. Please log in again." });
      }
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Middleware to check admin role
exports.admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized, no user data" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }

  next();
};

// Middleware to check staff or admin role
exports.staffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized, no user data" });
  }

  if (!["staff", "admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Staff or Admins only." });
  }

  next();
};