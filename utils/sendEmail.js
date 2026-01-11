const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send service OTP email to user
 * @param {Object} options
 * @param {string} options.to - recipient email
 * @param {string} options.otp - generated OTP
 * @param {string} options.serviceName - name of the service
 * @param {Date} options.eventDate - date of the service
 */
const sendOtpEmail = async ({ to, otp, serviceName, eventDate }) => {
  try {
    const templatePath = path.join(__dirname, "../emailTemplates/ServiceOtpTemplate.html");
    let htmlTemplate = fs.readFileSync(templatePath, "utf8");

    // Replace placeholders with dynamic data
    htmlTemplate = htmlTemplate
      .replace("{{OTP}}", otp)
      .replace("{{SERVICE_NAME}}", serviceName)
      .replace("{{SERVICE_DATE}}", new Date(eventDate).toDateString())
      .replace("{{CURRENT_YEAR}}", new Date().getFullYear());

    const mailOptions = {
      from: `"Service App" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your Service Completion OTP",
      html: htmlTemplate
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${to}`);
  } catch (error) {
    console.error("❌ Failed to send OTP email:", error.message);
    throw error;
  }
};

module.exports = { sendOtpEmail };
