const { Task, User, TaskHistory } = require('../models');
const { Op, sequelize } = require('sequelize');
const logger = require('../utils/logger');
const emailService = require('../services/email.service');

class TaskController {
  // Get all tasks with filtering and pagination
  async getAllTasks(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        category,
        search,
        sortBy = 'createdAt',
        order = 'DESC',
        dueFrom,
        dueTo,
        assignedTo,
        isRecurring,
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {};

      // Filter by user's access
      if (req.user.role !== 'admin') {
        where[Op.or] = [
          { userId: req.user.id },
          { assignedTo: req.user.id },
        ];
      }

      // Apply filters
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (category) where.category = category;
      if (assignedTo) where.assignedTo = assignedTo;
      if (isRecurring !== undefined) where.isRecurring = isRecurring === 'true';

      // Search in title and description
      if (search) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ];
      }

      // Date range filter
      if (dueFrom || dueTo) {
        where.dueDate = {};
        if (dueFrom) where.dueDate[Op.gte] = new Date(dueFrom);
        if (dueTo) where.dueDate[Op.lte] = new Date(dueTo);
      }

      const { count, rows } = await Task.findAndCountAll({
        where,
        include: [
          {
            association: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
          {
            association: 'assignee',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
        ],
        order: [[sortBy, order.toUpperCase()]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        data: {
          tasks: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get all tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tasks',
        error: error.message,
      });
    }
  }

  // Get single task by ID
  async getTaskById(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findByPk(id, {
        include: [
          {
            association: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
          {
            association: 'assignee',
            attributes: ['id', 'firstName', 'lastName', 'email'],
          },
          {
            association: 'history',
            include: ['user'],
            limit: 20,
            order: [['createdAt', 'DESC']],
          },
        ],
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      // Check access
      if (
        req.user.role !== 'admin' &&
        task.userId !== req.user.id &&
        task.assignedTo !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      res.json({
        success: true,
        data: { task },
      });
    } catch (error) {
      logger.error('Get task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch task',
        error: error.message,
      });
    }
  }

  // Create new task
  async createTask(req, res) {
    try {
      const taskData = {
        ...req.body,
        userId: req.user.id,
      };

      const task = await Task.create(taskData);

      // Create history entry
      await TaskHistory.create({
        taskId: task.id,
        userId: req.user.id,
        action: 'created',
        changes: { task: taskData },
      });

      // Send assignment notification if assigned to someone else
      if (task.assignedTo && task.assignedTo !== req.user.id) {
        const assignee = await User.findByPk(task.assignedTo);
        if (assignee && assignee.emailNotifications) {
          await emailService.sendTaskAssignment(assignee.email, {
            name: assignee.firstName,
            task: task.toJSON(),
            assignedBy: `${req.user.firstName} ${req.user.lastName}`,
          });
        }
      }

      logger.info(`Task created: ${task.id} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: { task },
      });
    } catch (error) {
      logger.error('Create task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create task',
        error: error.message,
      });
    }
  }

  // Update task
  async updateTask(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      // Check access
      if (
        req.user.role !== 'admin' &&
        task.userId !== req.user.id &&
        task.assignedTo !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const oldValues = task.toJSON();
      await task.update(updateData);

      // Create history entry
      await TaskHistory.create({
        taskId: task.id,
        userId: req.user.id,
        action: 'updated',
        oldValue: oldValues,
        newValue: task.toJSON(),
        changes: updateData,
      });

      logger.info(`Task updated: ${task.id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Task updated successfully',
        data: { task },
      });
    } catch (error) {
      logger.error('Update task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update task',
        error: error.message,
      });
    }
  }

  // Delete task
  async deleteTask(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      // Check access
      if (req.user.role !== 'admin' && task.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Only task creator or admin can delete tasks',
        });
      }

      // Create history entry before deletion
      await TaskHistory.create({
        taskId: task.id,
        userId: req.user.id,
        action: 'deleted',
        oldValue: task.toJSON(),
      });

      await task.destroy();

      logger.info(`Task deleted: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      logger.error('Delete task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete task',
        error: error.message,
      });
    }
  }

  // Mark task as complete
  async completeTask(req, res) {
    try {
      const { id } = req.params;

      const task = await Task.findByPk(id, {
        include: ['creator', 'assignee'],
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      // Check access
      if (
        req.user.role !== 'admin' &&
        task.userId !== req.user.id &&
        task.assignedTo !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      await task.markComplete();

      // Create history entry
      await TaskHistory.create({
        taskId: task.id,
        userId: req.user.id,
        action: 'completed',
      });

      // Send completion notification to creator if different from completer
      if (task.userId !== req.user.id && task.creator.emailNotifications) {
        await emailService.sendTaskCompletion(task.creator.email, {
          name: task.creator.firstName,
          task: task.toJSON(),
          completedBy: `${req.user.firstName} ${req.user.lastName}`,
        });
      }

      logger.info(`Task completed: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Task marked as complete',
        data: { task },
      });
    } catch (error) {
      logger.error('Complete task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete task',
        error: error.message,
      });
    }
  }

  // Assign task to user
  async assignTask(req, res) {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;

      const task = await Task.findByPk(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
        });
      }

      // Check access
      if (req.user.role !== 'admin' && task.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Only task creator or admin can assign tasks',
        });
      }

      // Verify assignee exists
      const assignee = await User.findByPk(assignedTo);
      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: 'Assignee not found',
        });
      }

      const oldAssignee = task.assignedTo;
      task.assignedTo = assignedTo;
      await task.save();

      // Create history entry
      await TaskHistory.create({
        taskId: task.id,
        userId: req.user.id,
        action: 'assigned',
        oldValue: { assignedTo: oldAssignee },
        newValue: { assignedTo },
      });

      // Send notification
      if (assignee.emailNotifications) {
        await emailService.sendTaskAssignment(assignee.email, {
          name: assignee.firstName,
          task: task.toJSON(),
          assignedBy: `${req.user.firstName} ${req.user.lastName}`,
        });
      }

      logger.info(`Task ${id} assigned to ${assignedTo} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Task assigned successfully',
        data: { task },
      });
    } catch (error) {
      logger.error('Assign task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign task',
        error: error.message,
      });
    }
  }

  // Get task statistics
  async getStatistics(req, res) {
    try {
      const where = {};

      // Filter by user access
      if (req.user.role !== 'admin') {
        where[Op.or] = [
          { userId: req.user.id },
          { assignedTo: req.user.id },
        ];
      }

      const totalTasks = await Task.count({ where });

      const statusStats = await Task.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where,
        group: ['status'],
      });

      const priorityStats = await Task.findAll({
        attributes: [
          'priority',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where,
        group: ['priority'],
      });

      const overdueCount = await Task.count({
        where: {
          ...where,
          status: 'overdue',
        },
      });

      const dueTodayCount = await Task.count({
        where: {
          ...where,
          dueDate: {
            [Op.gte]: new Date().setHours(0, 0, 0, 0),
            [Op.lt]: new Date().setHours(23, 59, 59, 999),
          },
          status: {
            [Op.notIn]: ['completed', 'cancelled'],
          },
        },
      });

      const recurringCount = await Task.count({
        where: {
          ...where,
          isRecurring: true,
        },
      });

      res.json({
        success: true,
        data: {
          overview: {
            totalTasks,
            overdueCount,
            dueTodayCount,
            recurringCount,
          },
          byStatus: statusStats,
          byPriority: priorityStats,
        },
      });
    } catch (error) {
      logger.error('Get statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
        error: error.message,
      });
    }
  }

  // Get upcoming tasks
  async getUpcomingTasks(req, res) {
    try {
      const { days = 7 } = req.query;

      const where = {
        dueDate: {
          [Op.gte]: new Date(),
          [Op.lte]: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        },
        status: {
          [Op.notIn]: ['completed', 'cancelled'],
        },
      };

      // Filter by user access
      if (req.user.role !== 'admin') {
        where[Op.or] = [
          { userId: req.user.id },
          { assignedTo: req.user.id },
        ];
      }

      const tasks = await Task.findAll({
        where,
        include: ['creator', 'assignee'],
        order: [['dueDate', 'ASC']],
        limit: 50,
      });

      res.json({
        success: true,
        data: { tasks },
      });
    } catch (error) {
      logger.error('Get upcoming tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upcoming tasks',
        error: error.message,
      });
    }
  }

  // Get overdue tasks
  async getOverdueTasks(req, res) {
    try {
      const where = {
        status: 'overdue',
      };

      // Filter by user access
      if (req.user.role !== 'admin') {
        where[Op.or] = [
          { userId: req.user.id },
          { assignedTo: req.user.id },
        ];
      }

      const tasks = await Task.findAll({
        where,
        include: ['creator', 'assignee'],
        order: [['dueDate', 'ASC']],
      });

      res.json({
        success: true,
        data: { tasks },
      });
    } catch (error) {
      logger.error('Get overdue tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get overdue tasks',
        error: error.message,
      });
    }
  }
}

module.exports = new TaskController();