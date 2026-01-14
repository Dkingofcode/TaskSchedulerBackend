const express = require('express');
const { body } = require('express-validator');
const taskController = require('../controllers/task.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

router.get('/', taskController.getAllTasks);
router.get('/statistics', taskController.getStatistics);
router.get('/upcoming', taskController.getUpcomingTasks);
router.get('/overdue', taskController.getOverdueTasks);
router.get('/:id', taskController.getTaskById);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('dueDate').optional().isISO8601(),
    body('category').optional().trim(),
    body('assignedTo').optional().isUUID(),
    body('isRecurring').optional().isBoolean(),
    body('recurrencePattern').optional().isIn(['daily', 'weekly', 'monthly', 'yearly', 'custom']),
    validate,
  ],
  taskController.createTask
);

router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.post('/:id/complete', taskController.completeTask);
router.post('/:id/assign', [body('assignedTo').isUUID(), validate], taskController.assignTask);

module.exports = router;