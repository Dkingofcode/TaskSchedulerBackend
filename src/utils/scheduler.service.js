const cron = require('node-cron');
const { Task, User } = require('../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const logger = require('../utils/logger');
const emailService = require('./email.service');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  // Initialize all scheduler jobs
  async initialize() {
    if (process.env.ENABLE_SCHEDULER !== 'true') {
      logger.info('⏸️  Task scheduler is disabled');
      return;
    }

    logger.info('🚀 Initializing task scheduler...');
    this.isRunning = true;

    // Check for overdue tasks every 5 minutes
    this.scheduleJob('check-overdue', '*/5 * * * *', () => this.checkOverdueTasks());

    // Send task reminders every minute
    this.scheduleJob('send-reminders', '* * * * *', () => this.sendTaskReminders());

    // Process recurring tasks every hour
    this.scheduleJob('process-recurring', '0 * * * *', () => this.processRecurringTasks());

    // Clean up old completed tasks daily at 2 AM
    this.scheduleJob('cleanup-tasks', '0 2 * * *', () => this.cleanupOldTasks());

    // Update task statistics hourly
    this.scheduleJob('update-stats', '0 * * * *', () => this.updateTaskStatistics());

    logger.info('✅ Task scheduler initialized successfully');
  }

  // Schedule a cron job
  scheduleJob(name, cronExpression, callback) {
    if (this.jobs.has(name)) {
      logger.warn(`Job ${name} already exists, stopping old instance`);
      this.jobs.get(name).stop();
    }

    const job = cron.schedule(cronExpression, async () => {
      logger.info(`📋 Running scheduled job: ${name}`);
      try {
        await callback();
      } catch (error) {
        logger.error(`Error in scheduled job ${name}:`, error);
      }
    });

    this.jobs.set(name, job);
    logger.info(`✅ Scheduled job: ${name} with cron: ${cronExpression}`);
  }

  // Check for overdue tasks and update their status
  async checkOverdueTasks() {
    try {
      const now = new Date();
      
      const overdueTasks = await Task.findAll({
        where: {
          dueDate: {
            [Op.lt]: now,
          },
          status: {
            [Op.notIn]: ['completed', 'cancelled', 'overdue'],
          },
        },
        include: [
          {
            association: 'creator',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
          {
            association: 'assignee',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      });

      if (overdueTasks.length === 0) {
        logger.info('No overdue tasks found');
        return;
      }

      logger.info(`Found ${overdueTasks.length} overdue tasks`);

      for (const task of overdueTasks) {
        // Update status to overdue
        task.status = 'overdue';
        await task.save();

        // Send overdue notification
        if (process.env.ENABLE_OVERDUE_NOTIFICATIONS === 'true') {
          await this.sendOverdueNotification(task);
        }

        logger.info(`Task ${task.id} marked as overdue`);
      }
    } catch (error) {
      logger.error('Error checking overdue tasks:', error);
    }
  }

  // Send task reminders
  async sendTaskReminders() {
    try {
      const reminderMinutes = parseInt(process.env.REMINDER_BEFORE_MINUTES) || 60;
      const now = new Date();
      const reminderTime = new Date(now.getTime() + reminderMinutes * 60000);

      const tasksNeedingReminder = await Task.findAll({
        where: {
          reminderEnabled: true,
          reminderSent: false,
          dueDate: {
            [Op.gte]: now,
            [Op.lte]: reminderTime,
          },
          status: {
            [Op.notIn]: ['completed', 'cancelled'],
          },
        },
        include: [
          {
            association: 'creator',
            attributes: ['id', 'email', 'firstName', 'lastName', 'emailNotifications'],
          },
          {
            association: 'assignee',
            attributes: ['id', 'email', 'firstName', 'lastName', 'emailNotifications'],
          },
        ],
      });

      if (tasksNeedingReminder.length === 0) {
        return;
      }

      logger.info(`Sending reminders for ${tasksNeedingReminder.length} tasks`);

      for (const task of tasksNeedingReminder) {
        await this.sendTaskReminder(task);
        task.reminderSent = true;
        task.reminderTime = now;
        await task.save();
      }
    } catch (error) {
      logger.error('Error sending task reminders:', error);
    }
  }

  // Process recurring tasks
  async processRecurringTasks() {
    try {
      const now = new Date();

      const recurringTasks = await Task.findAll({
        where: {
          isRecurring: true,
          status: {
            [Op.ne]: 'cancelled',
          },
          [Op.or]: [
            { nextOccurrence: null },
            { nextOccurrence: { [Op.lte]: now } },
          ],
        },
      });

      if (recurringTasks.length === 0) {
        logger.info('No recurring tasks to process');
        return;
      }

      logger.info(`Processing ${recurringTasks.length} recurring tasks`);

      for (const task of recurringTasks) {
        await this.createNextOccurrence(task);
      }
    } catch (error) {
      logger.error('Error processing recurring tasks:', error);
    }
  }

  // Create next occurrence of a recurring task
  async createNextOccurrence(task) {
    try {
      // Check if recurrence has ended
      if (task.recurrenceEndDate && new Date() > new Date(task.recurrenceEndDate)) {
        logger.info(`Recurring task ${task.id} has ended`);
        return;
      }

      // Calculate next occurrence based on pattern
      const nextDate = this.calculateNextOccurrence(task);

      if (!nextDate) {
        logger.warn(`Could not calculate next occurrence for task ${task.id}`);
        return;
      }

      // Create new task instance
      const newTask = await Task.create({
        userId: task.userId,
        assignedTo: task.assignedTo,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category: task.category,
        tags: task.tags,
        dueDate: nextDate,
        startDate: new Date(),
        estimatedDuration: task.estimatedDuration,
        reminderEnabled: task.reminderEnabled,
        notes: task.notes,
        metadata: {
          ...task.metadata,
          generatedFrom: task.id,
          occurrence: (task.metadata?.occurrence || 0) + 1,
        },
      });

      // Update original task
      task.lastOccurrence = new Date();
      task.nextOccurrence = nextDate;
      await task.save();

      logger.info(`Created next occurrence of task ${task.id}: ${newTask.id}`);
    } catch (error) {
      logger.error(`Error creating next occurrence for task ${task.id}:`, error);
    }
  }

  // Calculate next occurrence date
  calculateNextOccurrence(task) {
    const now = new Date();
    const interval = task.recurrenceInterval || 1;

    let nextDate;

    switch (task.recurrencePattern) {
      case 'daily':
        nextDate = moment(now).add(interval, 'days').toDate();
        break;

      case 'weekly':
        nextDate = moment(now).add(interval, 'weeks').toDate();
        break;

      case 'monthly':
        nextDate = moment(now).add(interval, 'months').toDate();
        break;

      case 'yearly':
        nextDate = moment(now).add(interval, 'years').toDate();
        break;

      case 'custom':
        if (task.cronExpression) {
          // Parse cron expression to get next date
          // This is simplified - you might want to use a cron parser library
          nextDate = moment(now).add(1, 'day').toDate();
        }
        break;

      default:
        return null;
    }

    return nextDate;
  }

  // Clean up old completed tasks
  async cleanupOldTasks() {
    try {
      const cleanupDays = parseInt(process.env.TASK_CLEANUP_DAYS) || 30;
      const cutoffDate = moment().subtract(cleanupDays, 'days').toDate();

      const result = await Task.destroy({
        where: {
          status: 'completed',
          completedAt: {
            [Op.lt]: cutoffDate,
          },
          isRecurring: false,
        },
      });

      logger.info(`Cleaned up ${result} old completed tasks`);
    } catch (error) {
      logger.error('Error cleaning up old tasks:', error);
    }
  }

  // Update task statistics
  async updateTaskStatistics() {
    try {
      const stats = await Task.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['status'],
      });

      logger.info('Task statistics updated:', stats);
    } catch (error) {
      logger.error('Error updating task statistics:', error);
    }
  }

  // Send task reminder email
  async sendTaskReminder(task) {
    try {
      const recipient = task.assignee || task.creator;
      
      if (!recipient || !recipient.emailNotifications) {
        return;
      }

      await emailService.sendTaskReminder(
        recipient.email,
        {
          name: recipient.firstName,
          task: {
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority,
          },
        }
      );

      logger.info(`Sent reminder for task ${task.id} to ${recipient.email}`);
    } catch (error) {
      logger.error(`Error sending reminder for task ${task.id}:`, error);
    }
  }

  // Send overdue notification
  async sendOverdueNotification(task) {
    try {
      const recipient = task.assignee || task.creator;
      
      if (!recipient || !recipient.emailNotifications) {
        return;
      }

      await emailService.sendOverdueNotification(
        recipient.email,
        {
          name: recipient.firstName,
          task: {
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority,
          },
        }
      );

      logger.info(`Sent overdue notification for task ${task.id} to ${recipient.email}`);
    } catch (error) {
      logger.error(`Error sending overdue notification for task ${task.id}:`, error);
    }
  }

  // Stop all scheduled jobs
  stopAll() {
    logger.info('Stopping all scheduled jobs...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });

    this.jobs.clear();
    this.isRunning = false;
    logger.info('All scheduled jobs stopped');
  }

  // Get status of all jobs
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      jobs: [],
    };

    this.jobs.forEach((job, name) => {
      status.jobs.push({
        name,
        running: job.running,
      });
    });

    return status;
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;