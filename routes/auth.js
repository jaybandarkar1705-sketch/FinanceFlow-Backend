const express = require('express');
const router = express.Router();
const {
  signup,
  signin,
  getMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/change-password', protect, changePassword);

module.exports = router;
