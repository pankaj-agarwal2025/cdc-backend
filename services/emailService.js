const nodemailer = require("nodemailer");
const User = require("../models/User");
const EmailTemplate = require("../models/EmailTemplate");
const EmailTracking = require("../models/EmailTracking");
const crypto = require("crypto");

const createTransporter = async () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_APP_PASSWORD;
  const emailService = process.env.EMAIL_SERVICE || "gmail";
  const emailFrom = process.env.EMAIL_FROM || `"Campus Connect" <${emailUser}>`;

  if (!emailUser || !emailPass) {
    throw new Error(
      "Email credentials not configured. Please set EMAIL_USER and EMAIL_APP_PASSWORD environment variables."
    );
  }

  const transporter = nodemailer.createTransport({
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    await transporter.verify();
    console.log("SMTP connection verified successfully");
    return { transporter, emailUser, emailFrom };
  } catch (error) {
    console.error("SMTP connection verification failed:", error);
    throw new Error(`Failed to create email transporter: ${error.message}`);
  }
};

const sendBulkEmail = async (senderUserId, recipientIds, subject, content, attachments = [], options = {}) => {
  try {
    const sender = await User.findById(senderUserId);
    if (!sender) {
      throw new Error("Sender not found");
    }

    const { transporter, emailFrom } = await createTransporter();
    const recipients = await User.find({ _id: { $in: recipientIds } });

    if (!recipients.length) {
      throw new Error("No valid recipients found");
    }

    const campaignId = crypto.randomBytes(16).toString("hex");
    const results = {
      successful: [],
      failed: [],
    };

    const frontendUrl = process.env.FRONTEND_URL || "https://campusconnectkrmu.onrender.com";

    for (const recipient of recipients) {
      try {
        const trackingRecord = new EmailTracking({
          campaign: campaignId,
          sender: senderUserId,
          recipient: recipient._id,
          subject: subject,
          status: options.scheduledDateTime ? "scheduled" : "sent",
          scheduledFor: options.scheduledDateTime || null,
        });

        await trackingRecord.save();

        let emailHtml = content.replace("{{recipient.email}}", recipient.email);
        emailHtml = emailHtml.replace("{{frontendUrl}}", frontendUrl);
        if (options.trackOpens) {
          const trackingPixel = `<img src="${process.env.BACKEND_URL}/api/email/track/${trackingRecord._id}" width="1" height="1" alt="" style="display:none" />`;
          emailHtml += trackingPixel;
        }

        const mailOptions = {
          from: emailFrom,
          to: recipient.email,
          subject: subject,
          html: emailHtml,
        };

        if (attachments && attachments.length > 0) {
          mailOptions.attachments = attachments.map((file) => ({
            filename: file.originalname,
            path: file.path,
          }));
        }

        if (options.scheduledDateTime && new Date(options.scheduledDateTime) > new Date()) {
          const timeUntilSend = new Date(options.scheduledDateTime) - new Date();
          setTimeout(async () => {
            try {
              const info = await transporter.sendMail(mailOptions);
              await EmailTracking.findByIdAndUpdate(trackingRecord._id, {
                status: "sent",
                sent: new Date(),
              });
            } catch (err) {
              console.error(`Scheduled email to ${recipient.email} failed:`, err);
              await EmailTracking.findByIdAndUpdate(trackingRecord._id, {
                status: "failed",
                error: err.message,
              });
            }
          }, timeUntilSend);

          results.successful.push({
            email: recipient.email,
            status: "scheduled",
            scheduledFor: options.scheduledDateTime,
            trackingId: trackingRecord._id,
          });
        } else {
          const info = await transporter.sendMail(mailOptions);
          await EmailTracking.findByIdAndUpdate(trackingRecord._id, {
            status: "delivered",
            sent: new Date(),
          });

          results.successful.push({
            email: recipient.email,
            messageId: info.messageId,
            status: "sent",
            trackingId: trackingRecord._id,
          });
        }
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        results.failed.push({
          email: recipient.email,
          error: error.message,
        });
        await new EmailTracking({
          campaign: campaignId,
          sender: senderUserId,
          recipient: recipient._id,
          subject: subject,
          status: "failed",
          error: error.message,
        }).save();
      }
    }

    return {
      campaignId,
      totalRecipients: recipients.length,
      sent: results.successful.length,
      failed: results.failed.length,
      details: results,
    };
  } catch (error) {
    console.error("Error in sendBulkEmail:", error);
    throw new Error(`Failed to send bulk email: ${error.message}`);
  }
};
/**
 * Get user groups for email targeting
 * @returns {Object} - User groups data
 */
const fetchUserGroups = async () => {
  try {
    // Get all active users with relevant fields
    const users = await User.find(
      { status: "active" },
      "_id fullName firstName lastName email role department enrolledCourses"
    )

    return {
      users,
      count: users.length,
    }
  } catch (error) {
    console.error("Error fetching user groups:", error)
    throw new Error("Failed to fetch user groups")
  }
}

/**
 * Save email template
 * @param {String} userId - ID of user saving the template
 * @param {Object} templateData - Template data (name, subject, content)
 * @returns {Object} - Saved template
 */
const saveEmailTemplate = async (userId, templateData) => {
  try {
    const template = new EmailTemplate({
      name: templateData.name,
      subject: templateData.subject,
      content: templateData.content,
      createdBy: userId,
    })

    await template.save()
    return template
  } catch (error) {
    console.error("Error saving email template:", error)
    throw new Error("Failed to save email template")
  }
}

/**
 * Fetch email templates for a user
 * @param {String} userId - User ID
 * @returns {Object} - User's templates
 */
const fetchEmailTemplates = async (userId) => {
  try {
    const templates = await EmailTemplate.find({ createdBy: userId })
    return { templates }
  } catch (error) {
    console.error("Error fetching email templates:", error)
    throw new Error("Failed to fetch email templates")
  }
}

/**
 * Track email open event
 * @param {String} trackingId - Email tracking ID
 * @returns {Boolean} - Success status
 */
const trackEmailOpen = async (trackingId) => {
  try {
    await EmailTracking.findByIdAndUpdate(trackingId, {
      status: "opened",
      opened: new Date(),
      $inc: { clickCount: 1 },
    })
    return true
  } catch (error) {
    console.error("Error tracking email open:", error)
    return false
  }
}

/**
 * Get email analytics for a campaign
 * @param {String} userId - User ID of the sender
 * @param {String} campaignId - Email campaign ID
 * @returns {Object} - Campaign analytics
 */
const getEmailAnalytics = async (userId, campaignId) => {
  try {
    // Get all tracking records for this campaign
    const records = await EmailTracking.find({
      campaign: campaignId,
      sender: userId,
    }).populate("recipient", "fullName email")

    if (!records.length) {
      return { message: "No data found for this campaign" }
    }

    // Calculate analytics
    const total = records.length
    const delivered = records.filter((r) => ["delivered", "opened"].includes(r.status)).length
    const opened = records.filter((r) => r.status === "opened").length
    const failed = records.filter((r) => r.status === "failed").length
    const scheduled = records.filter((r) => r.status === "scheduled").length

    // Calculate open rate
    const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : 0

    // Get list of recipients who opened
    const openedBy = records
      .filter((r) => r.status === "opened")
      .map((r) => ({
        name: r.recipient.fullName,
        email: r.recipient.email,
        openedAt: r.opened,
      }))

    // Get list of failures
    const failedRecipients = records
      .filter((r) => r.status === "failed")
      .map((r) => ({
        name: r.recipient.fullName,
        email: r.recipient.email,
        error: r.error,
      }))

    return {
      campaignId,
      subject: records[0].subject,
      sentAt: records[0].sent,
      stats: {
        total,
        delivered,
        opened,
        failed,
        scheduled,
        openRate: `${openRate}%`,
      },
      openedBy,
      failedRecipients,
    }
  } catch (error) {
    console.error("Error fetching email analytics:", error)
    throw new Error("Failed to fetch email analytics")
  }
}

/**
 * Get system email configuration
 * @returns {Object} - System email configuration
 */
const getSystemEmailConfig = async () => {
  try {
    const { emailUser, emailName } = await createTransporter();
    return {
      emailAddress: emailUser,
      displayName: emailName
    };
  } catch (error) {
    console.error("Error getting system email config:", error);
    throw new Error("Failed to get system email configuration");
  }
}
/**
 * Send a verification email to a user
 * @param {Object} user - User object containing email and fullName
 * @param {String} token - Verification token
 * @returns {Promise} - Resolves when email is sent
 */
/**
 * Send a verification email to a user
 * @param {Object} user - User object containing email and fullName
 * @param {String} token - Verification token
 * @returns {Promise} - Resolves when email is sent
 */
const sendVerificationEmail = async (user, token) => {
  try {
    const { transporter, getVerificationEmailTemplate } = require('../config/emailConfig');
    
    // Use BACKEND_URL for direct verification
    const verificationLink = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`;
    
    // Log the link for debugging
    console.log("BACKEND_URL:", process.env.BACKEND_URL);
    console.log("Verification Link:", verificationLink);
    
    // Get email template
    const { subject, html } = getVerificationEmailTemplate(user.fullName, verificationLink);
    
    // Prepare email options
    const mailOptions = {
      from: `"${process.env.EMAIL_DISPLAY_NAME || 'Campus Connect'}" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html,
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${user.email}: ${info.messageId}`);
  } catch (error) {
    console.error(`Failed to send verification email to ${user.email}:`, error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

module.exports = {
  sendBulkEmail,
  fetchUserGroups,
  saveEmailTemplate,
  fetchEmailTemplates,
  trackEmailOpen,
  getEmailAnalytics,
  getSystemEmailConfig,
  sendVerificationEmail
}