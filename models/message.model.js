const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;