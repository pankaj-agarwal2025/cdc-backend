const emailService = require("../services/emailService")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../Uploads/email-attachments")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
})

/**
 * Get system email configuration
 */
exports.getSystemEmailConfig = async (req, res) => {
  try {
    res.setHeader("Content-Type", "application/json")
    const emailConfig = await emailService.getSystemEmailConfig()
    res.status(200).json(emailConfig)
  } catch (error) {
    console.error("Error in getSystemEmailConfig:", error)
    res.status(500).json({ message: error.message })
  }
}

/**
 * Get user groups for email targeting
 */
exports.getUserGroups = async (req, res) => {
  try {
    // Ensure we're sending a proper JSON response
    res.setHeader("Content-Type", "application/json")

    const userGroups = await emailService.fetchUserGroups()

    // Validate the data structure before sending
    if (!userGroups || !userGroups.users) {
      return res.status(500).json({
        message: "Invalid user groups data structure",
        error: "Expected object with users array",
      })
    }

    res.status(200).json(userGroups)
  } catch (error) {
    console.error("Error in getUserGroups:", error)
    // Ensure we're sending a proper JSON error response
    res.status(500).json({ message: error.message })
  }
}

/**
 * Get email templates for a user
 */
exports.getEmailTemplates = async (req, res) => {
  try {
    // Ensure we're sending a proper JSON response
    res.setHeader("Content-Type", "application/json")

    const userId = req.user.id // From auth middleware
    const templates = await emailService.fetchEmailTemplates(userId)
    res.status(200).json(templates)
  } catch (error) {
    console.error("Error in getEmailTemplates:", error)
    res.status(500).json({ message: error.message })
  }
}

/**
 * Save an email template
 */
exports.saveEmailTemplate = async (req, res) => {
  try {
    // Ensure we're sending a proper JSON response
    res.setHeader("Content-Type", "application/json")

    const userId = req.user.id // From auth middleware
    const templateData = {
      name: req.body.name,
      subject: req.body.subject,
      content: req.body.content,
    }

    const savedTemplate = await emailService.saveEmailTemplate(userId, templateData)
    res.status(201).json(savedTemplate)
  } catch (error) {
    console.error("Error in saveEmailTemplate:", error)
    res.status(500).json({ message: error.message })
  }
}

/**
 * Send bulk email
 */
exports.sendBulkEmail = async (req, res) => {
  try {
    // Ensure we're sending a proper JSON response
    res.setHeader("Content-Type", "application/json")

    const userId = req.user.id // From auth middleware
    const { subject, content, recipients, trackOpens, scheduledDateTime } = req.body

    // Parse recipients if it's a JSON string
    const recipientIds = typeof recipients === "string" ? JSON.parse(recipients) : recipients

    // Create options object
    const options = {
      trackOpens: trackOpens === "true" || trackOpens === true,
    }

    // Add scheduled date if provided
    if (scheduledDateTime) {
      options.scheduledDateTime = scheduledDateTime
    }

    // Get attachments from multer
    const attachments = req.files || []

    // Send emails from the system email address
    const result = await emailService.sendBulkEmail(userId, recipientIds, subject, content, attachments, options)

    res.status(200).json(result)
  } catch (error) {
    console.error("Error in sendBulkEmail:", error)
    res.status(500).json({ message: error.message })
  }
}

/**
 * Track email opens
 */
exports.trackEmailOpen = async (req, res) => {
  try {
    const trackingId = req.params.trackingId

    // Log this open in the database
    await emailService.trackEmailOpen(trackingId)

    // Return a 1x1 transparent GIF
    const transparentPixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")
    res.setHeader("Content-Type", "image/gif")
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
    res.end(transparentPixel)
  } catch (error) {
    console.error("Error in trackEmailOpen:", error)
    // Still return the pixel even if tracking fails
    const transparentPixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")
    res.setHeader("Content-Type", "image/gif")
    res.end(transparentPixel)
  }
}

/**
 * Get email analytics
 */
exports.getEmailAnalytics = async (req, res) => {
  try {
    // Ensure we're sending a proper JSON response
    res.setHeader("Content-Type", "application/json")

    const userId = req.user.id
    const { campaignId } = req.params

    const analytics = await emailService.getEmailAnalytics(userId, campaignId)
    res.status(200).json(analytics)
  } catch (error) {
    console.error("Error in getEmailAnalytics:", error)
    res.status(500).json({ message: error.message })
  }
}

// Export the upload middleware for use in routes
exports.uploadAttachments = upload.array("attachments", 5) // Max 5 attachments