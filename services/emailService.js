const nodemailer = require('nodemailer');

const createTransporter = () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || 
      process.env.EMAIL_USER === 'your_email@gmail.com') {
    console.warn('⚠️  Email credentials not configured. Using development fallback.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Sends OTP email for password reset
 * In development (no email configured), logs OTP to console
 */
const sendOTPEmail = async (email, otp) => {
  const transporter = createTransporter();

  // Development fallback: log OTP to console
  if (!transporter) {
    console.log('\n====================================');
    console.log('📧 DEVELOPMENT MODE - OTP EMAIL');
    console.log(`📬 To: ${email}`);
    console.log(`🔑 OTP: ${otp}`);
    console.log('⏱️  Expires in: 10 minutes');
    console.log('====================================\n');
    return { success: true, devMode: true };
  }

  const mailOptions = {
    from: `"FinanceFlow" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'FinanceFlow - Password Reset OTP',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>FinanceFlow - Password Reset</title>
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px;text-align:center;">
                    <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
                      💰 FinanceFlow
                    </div>
                    <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:6px;">
                      Personal Finance Tracker
                    </div>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 32px;">
                    <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 16px;font-weight:700;">
                      Password Reset Request
                    </h2>
                    <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 28px;">
                      We received a request to reset your FinanceFlow account password. 
                      Use the OTP below to complete the process.
                    </p>
                    <!-- OTP Box -->
                    <div style="background:#0f172a;border:2px solid #0ea5e9;border-radius:12px;padding:24px;text-align:center;margin:0 0 28px;">
                      <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">
                        YOUR VERIFICATION CODE
                      </div>
                      <div style="font-size:42px;font-weight:800;color:#0ea5e9;letter-spacing:12px;font-family:monospace;">
                        ${otp}
                      </div>
                      <div style="color:#64748b;font-size:12px;margin-top:10px;">
                        ⏱ Expires in 10 minutes
                      </div>
                    </div>
                    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0;border-top:1px solid #334155;padding-top:20px;">
                      If you didn't request a password reset, please ignore this email. 
                      Your account remains secure. Never share this code with anyone.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#0f172a;padding:20px 32px;text-align:center;border-top:1px solid #334155;">
                    <p style="color:#475569;font-size:12px;margin:0;">
                      © 2024 FinanceFlow. Built for Practical 9.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  return { success: true, devMode: false };
};

module.exports = { sendOTPEmail };
