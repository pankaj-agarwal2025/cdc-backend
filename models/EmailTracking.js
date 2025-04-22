// models/EmailTracking.js
const mongoose = require('mongoose');

const EmailTrackingSchema = new mongoose.Schema({
  campaign: {
    type: String,
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  sent: {
    type: Date,
    default: Date.now
  },
  opened: {
    type: Date
  },
  clickCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'opened', 'failed', 'scheduled'],
    default: 'sent'
  },
  scheduledFor: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('EmailTracking', EmailTrackingSchema);