const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  email: { type: String, required: false, unique: true, sparse: true },
  phoneNumber: { type: String, required: false, unique: true, sparse: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  birthday: { type: String, required: true },
  status: { type: String, default: 'Online' },
  username: { type: String, required: true, unique: true },
  bio: { type: String, required: false },
  profilePic: {
    type: String,
    default: 'https://discord-clone-etat.onrender.com/uploads/default.png',
  },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema)

module.exports = User
