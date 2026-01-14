const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    if (process.env.ENABLE_EMAIL === 'true') {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }

  // Send email
  async sendEmail({ to, subject, html, text }) {
    if (!this.transporter) {
      logger.warn('Email service not configured');
      return null;
    }

    try {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }

  // Send task reminder
  async sendTaskReminder(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .task-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
          .priority { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; }
          .priority-high { background: #f44336; }
          .priority-medium { background: #ff9800; }
          .priority-low { background: #2196F3; }
          .priority-urgent { background: #9C27B0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Task Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>This is a reminder that you have an upcoming task:</p>
            
            <div class="task-details">
              <h3>${data.task.title}</h3>
              <p><strong>Due Date:</strong> ${new Date(data.task.dueDate).toLocaleString()}</p>
              <p><strong>Priority:</strong> <span class="priority priority-${data.task.priority}">${data.task.priority.toUpperCase()}</span></p>
            </div>
            
            <p>Make sure to complete this task on time!</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `⏰ Reminder: ${data.task.title}`,
      html,
    });
  }

  // Send overdue notification
  async sendOverdueNotification(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .task-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #f44336; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Task Overdue</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            
            <div class="warning">
              <strong>⚠️ Attention:</strong> The following task is now overdue!
            </div>
            
            <div class="task-details">
              <h3>${data.task.title}</h3>
              <p><strong>Was Due:</strong> ${new Date(data.task.dueDate).toLocaleString()}</p>
              <p><strong>Priority:</strong> ${data.task.priority.toUpperCase()}</p>
            </div>
            
            <p>Please update the task status or reschedule it as soon as possible.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `⚠️ Task Overdue: ${data.task.title}`,
      html,
    });
  }

  // Send task assignment notification
  async sendTaskAssignment(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .task-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 New Task Assigned</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>A new task has been assigned to you:</p>
            
            <div class="task-details">
              <h3>${data.task.title}</h3>
              <p>${data.task.description || 'No description provided'}</p>
              <p><strong>Assigned by:</strong> ${data.assignedBy}</p>
              <p><strong>Due Date:</strong> ${new Date(data.task.dueDate).toLocaleString()}</p>
              <p><strong>Priority:</strong> ${data.task.priority.toUpperCase()}</p>
            </div>
            
            <p>Please review and start working on this task.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `📋 New Task Assigned: ${data.task.title}`,
      html,
    });
  }

  // Send task completion notification
  async sendTaskCompletion(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; margin: 10px 0; color: #155724; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Task Completed</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            
            <div class="success">
              <strong>✅ Great job!</strong> The following task has been completed:
            </div>
            
            <p><strong>Task:</strong> ${data.task.title}</p>
            <p><strong>Completed by:</strong> ${data.completedBy}</p>
            <p><strong>Completion Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `✅ Task Completed: ${data.task.title}`,
      html,
    });
  }
}

module.exports = new EmailService();const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    if (process.env.ENABLE_EMAIL === 'true') {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    }
  }

  // Send email
  async sendEmail({ to, subject, html, text }) {
    if (!this.transporter) {
      logger.warn('Email service not configured');
      return null;
    }

    try {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }

  // Send task reminder
  async sendTaskReminder(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .task-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
          .priority { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; }
          .priority-high { background: #f44336; }
          .priority-medium { background: #ff9800; }
          .priority-low { background: #2196F3; }
          .priority-urgent { background: #9C27B0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Task Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>This is a reminder that you have an upcoming task:</p>
            
            <div class="task-details">
              <h3>${data.task.title}</h3>
              <p><strong>Due Date:</strong> ${new Date(data.task.dueDate).toLocaleString()}</p>
              <p><strong>Priority:</strong> <span class="priority priority-${data.task.priority}">${data.task.priority.toUpperCase()}</span></p>
            </div>
            
            <p>Make sure to complete this task on time!</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `⏰ Reminder: ${data.task.title}`,
      html,
    });
  }

  // Send overdue notification
  async sendOverdueNotification(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f44336; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .task-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #f44336; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Task Overdue</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            
            <div class="warning">
              <strong>⚠️ Attention:</strong> The following task is now overdue!
            </div>
            
            <div class="task-details">
              <h3>${data.task.title}</h3>
              <p><strong>Was Due:</strong> ${new Date(data.task.dueDate).toLocaleString()}</p>
              <p><strong>Priority:</strong> ${data.task.priority.toUpperCase()}</p>
            </div>
            
            <p>Please update the task status or reschedule it as soon as possible.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `⚠️ Task Overdue: ${data.task.title}`,
      html,
    });
  }

  // Send task assignment notification
  async sendTaskAssignment(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .task-details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 New Task Assigned</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            <p>A new task has been assigned to you:</p>
            
            <div class="task-details">
              <h3>${data.task.title}</h3>
              <p>${data.task.description || 'No description provided'}</p>
              <p><strong>Assigned by:</strong> ${data.assignedBy}</p>
              <p><strong>Due Date:</strong> ${new Date(data.task.dueDate).toLocaleString()}</p>
              <p><strong>Priority:</strong> ${data.task.priority.toUpperCase()}</p>
            </div>
            
            <p>Please review and start working on this task.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `📋 New Task Assigned: ${data.task.title}`,
      html,
    });
  }

  // Send task completion notification
  async sendTaskCompletion(email, data) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; margin: 20px 0; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; margin: 10px 0; color: #155724; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Task Completed</h1>
          </div>
          <div class="content">
            <p>Hi ${data.name},</p>
            
            <div class="success">
              <strong>✅ Great job!</strong> The following task has been completed:
            </div>
            
            <p><strong>Task:</strong> ${data.task.title}</p>
            <p><strong>Completed by:</strong> ${data.completedBy}</p>
            <p><strong>Completion Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Task Scheduler</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `✅ Task Completed: ${data.task.title}`,
      html,
    });
  }
}

module.exports = new EmailService();