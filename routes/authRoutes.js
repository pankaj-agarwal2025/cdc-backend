const express = require("express");
const { 
  registerUser, 
  loginUser, 
  verifyEmail, 
  resendVerification 
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { check } = require("express-validator");

const router = express.Router();

router.post(
  "/register",
  [
    check("fullName", "Full name is required").not().isEmpty(),
    check("rollNo", "Roll No is required").not().isEmpty(),
    check("email", "Please enter a valid email").isEmail(),
    check("password", "Password must be at least 6 characters").isLength({ min: 6 }),
  ],
  registerUser
);

router.post("/login", loginUser);

router.post("/verify-email", verifyEmail);

// New GET route to process verification directly
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("<h1>Error: Token is required</h1>");
  }
  try {
    await verifyEmail({ body: { token } }, {
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            return res.send(`
              <h1>Email Verified!</h1>
              <p>Your email has been successfully verified. Please <a href="https://campusconnectkrmu.onrender.com/auth-Container">log in</a> to continue.</p>
            `);
          }
          return res.status(code).send(`<h1>Error: ${data.message}</h1>`);
        },
      }),
    });
  } catch (error) {
    console.error("Error in GET /api/auth/verify-email:", error);
    res.status(500).send("<h1>Server Error</h1><p>Please try again later.</p>");
  }
});
router.post("/resend-verification", resendVerification);

router.get("/me", protect, (req, res) => {
  res.json({
    id: req.user._id,
    role: req.user.role,
    email: req.user.email,
    fullName: req.user.fullName,
  });
});

module.exports = router;