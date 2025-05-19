import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association,
  Sequelize,
} from 'sequelize';
import { sequelize } from '@/database';
import { User } from './user.model';

interface NotificationHistoryModel extends Model<
  InferAttributes<NotificationHistoryModel>,
  InferCreationAttributes<NotificationHistoryModel>
> {
  // Properties
  id: CreationOptional<string>;
  userId: string;
  type: 'pipeline' | 'test' | 'system' | 'broadcast' | 'test-flaky' | 'coverage';
  channel: 'email' | 'slack' | 'pushover';
  message: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  error?: string;
  metadata?: Record<string, any>;
  deliveryTime?: number;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  user?: NonAttribute<User>;
}

class NotificationHistory extends Model<
  InferAttributes<NotificationHistoryModel>,
  InferCreationAttributes<NotificationHistoryModel>
> implements NotificationHistoryModel {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare type: 'pipeline' | 'test' | 'system' | 'broadcast' | 'test-flaky' | 'coverage';
  declare channel: 'email' | 'slack' | 'pushover';
  declare message: string;
  declare status: 'pending' | 'sent' | 'failed' | 'delivered';
  declare error?: string;
  declare metadata?: Record<string, any>;
  declare deliveryTime?: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: NonAttribute<User>;

  // Static methods
  static associate(models: any): void {
    NotificationHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

NotificationHistory.init(
  {
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
    type: {
      type: DataTypes.ENUM(
        'pipeline',
        'test',
        'system',
        'broadcast',
        'test-flaky',
        'coverage'
      ),
      allowNull: false,
    },
    channel: {
      type: DataTypes.ENUM('email', 'slack', 'pushover'),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'delivered'),
      allowNull: false,
      defaultValue: 'pending',
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    deliveryTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Delivery time in milliseconds',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'notification_history',
    modelName: 'NotificationHistory',
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['channel'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

// Hooks
NotificationHistory.beforeCreate(async (notification: NotificationHistory) => {
  if (!notification.id) {
    notification.id = DataTypes.UUIDV4;
  }
});

NotificationHistory.afterUpdate(async (notification: NotificationHistory) => {
  if (notification.status === 'delivered' && notification.previous('status') !== 'delivered') {
    notification.deliveryTime = Date.now() - notification.createdAt.getTime();
  }
});

export { NotificationHistory };
export type NotificationHistoryAttributes = InferAttributes<NotificationHistoryModel>;
export type NotificationHistoryCreationAttributes = InferCreationAttributes<NotificationHistoryModel>;