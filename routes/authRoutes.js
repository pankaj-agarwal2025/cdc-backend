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
    return res.status(400).send(`
      <html>
        <head>
          <title>Verification Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .error { color: #e74c3c; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            a { color: #3498db; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Error: Invalid Verification Link</h1>
            <p>The verification link is missing a required token.</p>
            <p>Please check your email for the correct link or <a href="${process.env.FRONTEND_URL || 'https://campusconnectkrmu.onrender.com'}/auth-Container">return to login</a>.</p>
          </div>
        </body>
      </html>
    `);
  }
  
  try {
    // Create a response object that mimics Express but captures the response data
    const responseObj = {
      status: (code) => ({
        json: (data) => {
          if (code === 200) {
            // Success page with redirect
            return res.send(`
              <html>
                <head>
                  <title>Email Verified</title>
                  <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                    .success { color: #2ecc71; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .btn { 
                      display: inline-block; 
                      background-color: #3498db; 
                      color: white; 
                      padding: 10px 20px; 
                      border-radius: 5px; 
                      text-decoration: none;
                      margin-top: 20px;
                    }
                    .btn:hover {
                      background-color: #2980b9;
                    }
                  </style>
                  <meta http-equiv="refresh" content="5;url=${process.env.FRONTEND_URL || 'https://campusconnectkrmu.onrender.com'}/auth-Container" />
                </head>
                <body>
                  <div class="container">
                    <h1 class="success">Email Verified Successfully!</h1>
                    <p>Your account has been activated. You can now log in to access all features.</p>
                    <p>You will be redirected to the login page in 5 seconds...</p>
                    <a href="${process.env.FRONTEND_URL || 'https://campusconnectkrmu.onrender.com'}/auth-Container" class="btn">Log In Now</a>
                  </div>
                </body>
              </html>
            `);
          }
          
          // Error page
          return res.status(code).send(`
            <html>
              <head>
                <title>Verification Failed</title>
                <style>
                  body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                  .error { color: #e74c3c; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  a { color: #3498db; text-decoration: none; }
                  a:hover { text-decoration: underline; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1 class="error">Verification Failed</h1>
                  <p>${data.message || 'An error occurred during verification.'}</p>
                  <p>Please try again or <a href="${process.env.FRONTEND_URL || 'https://campusconnectkrmu.onrender.com'}/auth-Container">return to login</a>.</p>
                </div>
              </body>
            </html>
          `);
        },
      }),
    };
    
    // Call the existing verifyEmail controller with the token
    await verifyEmail({ body: { token } }, responseObj);
    
  } catch (error) {
    console.error("Error in GET /api/auth/verify-email:", error);
    res.status(500).send(`
      <html>
        <head>
          <title>Server Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .error { color: #e74c3c; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            a { color: #3498db; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Server Error</h1>
            <p>We encountered a problem while verifying your email.</p>
            <p>Please try again later or contact support if the problem persists.</p>
            <p><a href="${process.env.FRONTEND_URL || 'https://campusconnectkrmu.onrender.com'}/auth-Container">Return to login</a></p>
          </div>
        </body>
      </html>
    `);
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