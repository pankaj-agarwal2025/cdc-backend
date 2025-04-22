// models/EmailTemplate.js
const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  subject: { 
    type: String, 
    required: true,
    trim: true
  },
  content: { 
    type: String, 
    required: true 
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);