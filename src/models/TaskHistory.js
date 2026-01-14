const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const TaskHistory = sequelize.define('TaskHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  taskId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tasks',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  action: {
    type: DataTypes.ENUM(
      'created',
      'updated',
      'status_changed',
      'assigned',
      'completed',
      'cancelled',
      'deleted',
      'commented'
    ),
    allowNull: false,
  },
  changes: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Object containing the changes made',
  },
  oldValue: {
    type: DataTypes.JSONB,
  },
  newValue: {
    type: DataTypes.JSONB,
  },
  comment: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'task_history',
  timestamps: true,
  updatedAt: false,
  indexes: [
    {
      fields: ['taskId'],
    },
    {
      fields: ['userId'],
    },
    {
      fields: ['action'],
    },
    {
      fields: ['createdAt'],
    },
  ],
});

module.exports = TaskHistory;