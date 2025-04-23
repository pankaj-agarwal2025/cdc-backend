const User = require("../models/User")
const emailService = require("./emailService")

/**
 * Send job notification emails to all students
 * @param {Object} job - The job that was approved
 * @returns {Object} - Results of the email sending operation
 */
const sendJobApprovalNotifications = async (job) => {
  try {
    // Find all active students
    const students = await User.find({
      role: "student",
      status: "active",
    })

    if (!students.length) {
      console.log("No active students found to notify")
      return { success: false, message: "No active students found" }
    }

    // Get student IDs for bulk email
    const studentIds = students.map((student) => student._id)

    // Create email content
    const subject = `New Job Opportunity: ${job.profiles} at ${job.companyName}`

    // Format the job details in HTML
    const content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">New Job Opportunity</h2>
        <p>Hello,</p>
        <p>A new job opportunity has been posted that might interest you:</p>
        
        <div style="background-color: #f7fafc; border-left: 4px solid #4299e1; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #2d3748;">${job.profiles} at ${job.companyName}</h3>
          <p><strong>Location:</strong> ${job.location}</p>
          <p><strong>Offer Type:</strong> ${job.offerType.join(", ")}</p>
          <p><strong>CTC/Stipend:</strong> ${job.ctcOrStipend}</p>
          <p><strong>Required Skills:</strong> ${job.skills.join(", ")}</p>
          
          ${job.eligibility ? `<p><strong>Eligibility:</strong> ${job.eligibility}</p>` : ''}
          ${job.dateOfJoining ? `<p><strong>Date of Joining:</strong> ${new Date(job.dateOfJoining).toLocaleDateString()}</p>` : ''}
        </div>
        
        <p>To apply and view full details, please log in to the Campus Connect portal.</p>
        <p>Best regards,<br>Campus Connect Team</p>
      </div>
    `

    // Send bulk email using the existing email service
    // We'll use a system admin ID for the sender (you may need to adjust this)
    const systemAdminId = process.env.SYSTEM_ADMIN_ID || "system"
    const emailResult = await emailService.sendBulkEmail(
      systemAdminId,
      studentIds,
      subject,
      content,
      [], // No attachments
      { trackOpens: true }, // Enable open tracking
    )

    console.log(`Job notification emails sent: ${emailResult.sent} successful, ${emailResult.failed} failed`)
    
    return {
      success: true,
      ...emailResult,
    }
  } catch (error) {
    console.error("Error sending job approval notifications:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

// Export the notification functions
module.exports = {
  sendJobApprovalNotifications,
}