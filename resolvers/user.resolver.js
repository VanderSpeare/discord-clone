const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { generateUniqueUsername, validateEmail, uploadProfilePic } = require('../services/user.service');

const userResolver = {
  user: async ({ id }) => {
    try {
      const user = await User.findById(id);
      return user;
    } catch (error) {
      throw new Error('User not found');
    }
  },

  updateUser: async ({ id, displayName, bio, status, profilePic }, { file }) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      if (displayName) user.displayName = displayName;
      if (bio) user.bio = bio;
      if (status) user.status = status;
      if (file) await uploadProfilePic(user, file);
      else if (profilePic) user.profilePic = profilePic;

      await user.save();
      return { ...user._doc, password: null };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  createUser: async ({ email, password, displayName, birthday, phoneNumber, file }) => {
    // Kiểm tra ít nhất một trong email hoặc phoneNumber được cung cấp
    if (!email && !phoneNumber) {
      throw new Error('Email or phone number is required');
    }

    // Xác thực email nếu có
    if (email && !validateEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Kiểm tra trùng lặp email hoặc phoneNumber
    const existingUserByEmail = email ? await User.findOne({ email }) : null;
    const existingUserByPhone = phoneNumber ? await User.findOne({ phoneNumber }) : null;
    if (existingUserByEmail) {
      throw new Error('Email already exists');
    }
    if (existingUserByPhone) {
      throw new Error('Phone number already exists');
    }

    const username = await generateUniqueUsername(displayName);

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = new User({
        email: email || null,
        phoneNumber: phoneNumber || null,
        password: hashedPassword,
        displayName,
        username,
        birthday,
        profilePic: file ? await uploadProfilePic(new User(), file) : 'https://discord-clone-etat.onrender.com/uploads/default.png',
      });

      await user.save();

      const token = jwt.sign(
        { userId: user.id, email: user.email || '', phoneNumber: user.phoneNumber || '' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return {
        _id: user._id,
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        displayName: user.displayName,
        username: user.username,
        birthday: user.birthday,
        createdAt: user.createdAt,
        profilePic: user.profilePic,
        status: user.status,
        token,
        tokenExpiration: 1,
      };
    } catch (error) {
      throw new Error('Error creating user: ' + error.message);
    }
  },

  deleteUser: async ({ id }) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }
      await User.deleteOne({ _id: id });
      return `User with ID ${id} has been deleted successfully.`;
    } catch (error) {
      throw new Error('Error deleting user');
    }
  },

  signIn: async ({ email, password }) => {
    const user = await User.findOne({ $or: [{ email }, { phoneNumber: email }] });
    if (!user) {
      throw new Error('User not found');
    }

    const isEqual = await bcrypt.compare(password, user.password);
    if (!isEqual) {
      throw new Error('Invalid password');
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email || '', phoneNumber: user.phoneNumber || '' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return {
      userId: user.id,
      token,
      tokenExpiration: 1,
      displayName: user.displayName,
      username: user.username,
      birthday: user.birthday,
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      createdAt: user.createdAt,
      profilePic: user.profilePic,
      status: user.status,
    };
  },
};

module.exports = userResolver;
