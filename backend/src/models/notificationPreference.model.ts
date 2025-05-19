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

interface NotificationPreferenceModel extends Model<
  InferAttributes<NotificationPreferenceModel>,
  InferCreationAttributes<NotificationPreferenceModel>
> {
  // Properties
  id: CreationOptional<string>;
  userId: string;
  preferences: {
    email?: {
      enabled: boolean;
      address: string;
      digest: boolean;
      digestFrequency: 'daily' | 'weekly';
    };
    slack?: {
      enabled: boolean;
      channel: string;
      mentions: string[];
    };
    pushover?: {
      enabled: boolean;
      deviceGroups: string[];
      priority: number;
    };
    conditions: {
      pipelineStart: boolean;
      pipelineSuccess: boolean;
      pipelineFailure: boolean;
      testFlaky: boolean;
      coverageDecrease: boolean;
    };
  };
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  user?: NonAttribute<User>;
}

class NotificationPreference extends Model<
  InferAttributes<NotificationPreferenceModel>,
  InferCreationAttributes<NotificationPreferenceModel>
> implements NotificationPreferenceModel {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare preferences: {
    email?: {
      enabled: boolean;
      address: string;
      digest: boolean;
      digestFrequency: 'daily' | 'weekly';
    };
    slack?: {
      enabled: boolean;
      channel: string;
      mentions: string[];
    };
    pushover?: {
      enabled: boolean;
      deviceGroups: string[];
      priority: number;
    };
    conditions: {
      pipelineStart: boolean;
      pipelineSuccess: boolean;
      pipelineFailure: boolean;
      testFlaky: boolean;
      coverageDecrease: boolean;
    };
  };
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: NonAttribute<User>;

  // Static methods
  static associate(models: any): void {
    NotificationPreference.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

NotificationPreference.init(
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
    preferences: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        conditions: {
          pipelineStart: false,
          pipelineSuccess: false,
          pipelineFailure: true,
          testFlaky: true,
          coverageDecrease: true,
        },
      },
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
    tableName: 'notification_preferences',
    modelName: 'NotificationPreference',
  }
);

export { NotificationPreference };
export type NotificationPreferenceAttributes = InferAttributes<NotificationPreferenceModel>;
export type NotificationPreferenceCreationAttributes = InferCreationAttributes<NotificationPreferenceModel>;