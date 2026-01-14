const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200],
    },
  },
  description: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'overdue'),
    defaultValue: 'pending',
    allowNull: false,
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
  },
  dueDate: {
    type: DataTypes.DATE,
  },
  startDate: {
    type: DataTypes.DATE,
  },
  completedAt: {
    type: DataTypes.DATE,
  },
  // Recurring task configuration
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  recurrencePattern: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly', 'custom'),
    allowNull: true,
  },
  recurrenceInterval: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Interval for recurrence (e.g., every 2 weeks)',
  },
  cronExpression: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Cron expression for custom schedules',
  },
  recurrenceEndDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastOccurrence: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  nextOccurrence: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Task assignment and collaboration
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  // Categories and tags
  category: {
    type: DataTypes.STRING(100),
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  // Progress tracking
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100,
    },
  },
  estimatedDuration: {
    type: DataTypes.INTEGER,
    comment: 'Estimated duration in minutes',
  },
  actualDuration: {
    type: DataTypes.INTEGER,
    comment: 'Actual duration in minutes',
  },
  // Notifications
  reminderEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  reminderSent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  reminderTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Dependencies
  dependsOn: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: [],
    comment: 'Array of task IDs this task depends on',
  },
  // Metadata
  notes: {
    type: DataTypes.TEXT,
  },
  attachments: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'tasks',
  timestamps: true,
  indexes: [
    {
      fields: ['userId'],
    },
    {
      fields: ['assignedTo'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['priority'],
    },
    {
      fields: ['dueDate'],
    },
    {
      fields: ['isRecurring'],
    },
    {
      fields: ['nextOccurrence'],
    },
    {
      fields: ['category'],
    },
  ],
});

// Instance methods
Task.prototype.isOverdue = function() {
  if (!this.dueDate || this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > new Date(this.dueDate);
};

Task.prototype.canStart = async function() {
  if (!this.dependsOn || this.dependsOn.length === 0) {
    return true;
  }

  const dependencies = await Task.findAll({
    where: {
      id: this.dependsOn,
    },
  });

  return dependencies.every(dep => dep.status === 'completed');
};

Task.prototype.markComplete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  this.progress = 100;
  await this.save();
};

Task.prototype.needsReminder = function() {
  if (!this.reminderEnabled || this.reminderSent || !this.dueDate) {
    return false;
  }

  const reminderMinutes = parseInt(process.env.REMINDER_BEFORE_MINUTES) || 60;
  const reminderTime = new Date(this.dueDate);
  reminderTime.setMinutes(reminderTime.getMinutes() - reminderMinutes);

  return new Date() >= reminderTime && new Date() < this.dueDate;
};

module.exports = Task;