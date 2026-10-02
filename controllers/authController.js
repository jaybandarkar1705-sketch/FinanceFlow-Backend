const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { generateOTP, getOTPExpiry } = require('../utils/otpGenerator');
const { sendOTPEmail } = require('../services/emailService');
const bcrypt = require('bcryptjs');

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  // --- Diagnostic: log request entry ---
  console.log('[Signup] POST /api/auth/signup received');
  console.log('[Signup] Payload fields:', {
    username: req.body.username,
    email: req.body.email,
    hasPassword: !!req.body.password,
    hasConfirmPassword: !!req.body.confirmPassword,
  });

  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      console.log('[Signup] Validation failed: missing fields');
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    if (password !== confirmPassword) {
      console.log('[Signup] Validation failed: passwords do not match');
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    if (password.length < 6) {
      console.log('[Signup] Validation failed: password too short');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check duplicate email
    console.log('[Signup] Checking for existing user with email:', email.toLowerCase());
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('[Signup] Duplicate email detected:', email.toLowerCase());
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Create user
    console.log('[Signup] Creating new user...');
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
    });
    console.log('[Signup] User created successfully, id:', user._id);

    const token = generateToken(user._id);
    console.log('[Signup] JWT generated. Responding 201.');

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    // Duplicate key error from MongoDB (race condition)
    if (error.code === 11000) {
      console.error('[Signup] MongoDB duplicate key error (race condition):', error.keyValue);
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Mongoose validation error — return the actual field message, not a generic 500
    if (error.name === 'ValidationError') {
      const firstMessage = Object.values(error.errors)[0]?.message || 'Validation failed.';
      console.error('[Signup] Mongoose ValidationError:', error.message);
      return res.status(400).json({
        success: false,
        message: firstMessage,
      });
    }

    console.error('[Signup] Unexpected error:', error.name, error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during signup. Please try again.',
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/signin
// @access  Public
const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Signed in successfully!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during sign in. Please try again.',
    });
  }
};

// @desc    Get current authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
};

// @desc    Send OTP for password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, you will receive an OTP shortly.',
      });
    }

    // Generate and save OTP
    const otp = generateOTP();
    const otpExpiry = getOTPExpiry();

    user.resetOTP = otp;
    user.resetOTPExpiry = otpExpiry;
    user.resetOTPAttempts = 0;
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    const result = await sendOTPEmail(email, otp);

    if (result.devMode) {
      return res.status(200).json({
        success: true,
        message: 'OTP sent successfully! Check the server console for the OTP (development mode).',
        devMode: true,
      });
    }

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, you will receive an OTP shortly.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.resetOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please request a new one.',
      });
    }

    // Check OTP attempts (max 5)
    if (user.resetOTPAttempts >= 5) {
      user.clearOTP();
      await user.save({ validateBeforeSave: false });
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
      });
    }

    // Check expiry
    if (new Date() > user.resetOTPExpiry) {
      user.clearOTP();
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Verify OTP
    if (user.resetOTP !== otp.trim()) {
      user.resetOTPAttempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - user.resetOTPAttempts} attempts remaining.`,
      });
    }

    // OTP is valid — generate a short-lived reset token
    const resetToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully!',
      resetToken,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Reset password after OTP verification
// @route   POST /api/auth/reset-password
// @access  Private (requires reset token)
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.resetOTP) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session. Please start the password reset process again.',
      });
    }

    // Verify OTP once more
    if (new Date() > user.resetOTPExpiry || user.resetOTP !== otp.trim()) {
      user.clearOTP();
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP. Please start the password reset process again.',
      });
    }

    // Update password
    user.password = newPassword;
    user.clearOTP();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// @desc    Change password (authenticated user)
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from the current password.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully!',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

module.exports = {
  signup,
  signin,
  getMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
  changePassword,
};
