const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Optional: Configure additional options
  tls: {
    rejectUnauthorized: false 
  }
});

// Verify connection configuration
const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email server connection error:', error);
    return false;
  }
};

// Email templates
const getVerificationEmailTemplate = (userName, verificationLink) => {
  return {
    subject: 'CampusConnect - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #3b82f6; text-align: center;">Welcome to CampusConnect!</h2>
        <p>Hello ${userName},</p>
        <p>Thank you for signing up with CampusConnect. To activate your account and gain full access to our platform, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${verificationLink}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
        </div>
        <p>This verification link will expire in <strong>15 minutes</strong>. If the link expires, you can request a new one on the login page.</p>
        <p>If you did not sign up for a CampusConnect account, please ignore this email.</p>
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
          <p>This is an automated email, please do not reply to this message.</p>
        </div>
      </div>
    `
  };
};

module.exports = {
  transporter,
  verifyEmailConfig,
  getVerificationEmailTemplate
};