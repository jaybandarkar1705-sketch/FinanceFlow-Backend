const crypto = require('crypto');

/**
 * Generates a 6-digit numeric OTP
 */
const generateOTP = () => {
  // Generate a random 6-digit number using crypto for security
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0);
  const otp = String(num % 1000000).padStart(6, '0');
  return otp;
};

/**
 * Returns OTP expiry time (10 minutes from now)
 */
const getOTPExpiry = () => {
  return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
};

module.exports = { generateOTP, getOTPExpiry };
