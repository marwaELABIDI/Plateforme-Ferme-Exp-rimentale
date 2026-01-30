const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send verification email
const sendVerificationEmail = async (email, token) => {
  const transporter = createTransporter();
  
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'AITTC Farm Management - Email Verification',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2c5aa0; color: white; padding: 20px; text-align: center;">
          <h1>AITTC Farm Management System</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>Welcome to AITTC Farm Management!</h2>
          
          <p>Thank you for registering with the AITTC Experimental Farm Management System. To complete your registration, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          
          <p>This verification link will expire in 24 hours.</p>
          
          <p>If you didn't create an account with us, please ignore this email.</p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>AITTC Experimental Farm Management System</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, token) => {
  const transporter = createTransporter();
  
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'AITTC Farm Management - Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2c5aa0; color: white; padding: 20px; text-align: center;">
          <h1>AITTC Farm Management System</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>Password Reset Request</h2>
          
          <p>You have requested to reset your password for the AITTC Farm Management System. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          
          <p>This reset link will expire in 24 hours.</p>
          
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>AITTC Experimental Farm Management System</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// Send notification email for reservation status change
const sendReservationStatusEmail = async (email, reservation, status, projectTitle) => {
  const transporter = createTransporter();
  
  const statusText = status === 'APPROVED' ? 'approved' : 'rejected';
  const statusColor = status === 'APPROVED' ? '#28a745' : '#dc3545';
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `AITTC Farm Management - Reservation ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2c5aa0; color: white; padding: 20px; text-align: center;">
          <h1>AITTC Farm Management System</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>Reservation Status Update</h2>
          
          <p>Your field reservation request has been <strong style="color: ${statusColor};">${statusText}</strong>.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Reservation Details:</h3>
            <p><strong>Project:</strong> ${projectTitle}</p>
            <p><strong>Surface Area:</strong> ${reservation.surfaceM2Requested} m²</p>
            <p><strong>Start Date:</strong> ${new Date(reservation.startRequested).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(reservation.endRequested).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
          </div>
          
          ${status === 'APPROVED' ? `
            <p>Your project has been approved and assigned to a supervisor. You will receive further updates on your project progress.</p>
          ` : `
            <p>If you have any questions about this decision, please contact the farm administration.</p>
          `}
        </div>
        
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>AITTC Experimental Farm Management System</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reservation status email sent to ${email}`);
  } catch (error) {
    console.error('Error sending reservation status email:', error);
    throw error;
  }
};

// Send notification email for project assignment
const sendProjectAssignmentEmail = async (email, project, supervisorName) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'AITTC Farm Management - Project Assignment',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2c5aa0; color: white; padding: 20px; text-align: center;">
          <h1>AITTC Farm Management System</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>Project Assignment Notification</h2>
          
          <p>You have been assigned as a supervisor for a new project at the AITTC Experimental Farm.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Project Details:</h3>
            <p><strong>Project Title:</strong> ${project.title}</p>
            <p><strong>Surface Area:</strong> ${project.surfaceM2} m²</p>
            <p><strong>Start Date:</strong> ${new Date(project.startDate).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'TBD'}</p>
            <p><strong>Status:</strong> ${project.status}</p>
          </div>
          
          <p>Please log in to the system to view project details and provide progress updates.</p>
        </div>
        
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>AITTC Experimental Farm Management System</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Project assignment email sent to ${email}`);
  } catch (error) {
    console.error('Error sending project assignment email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReservationStatusEmail,
  sendProjectAssignmentEmail
}; 