import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association,
  Sequelize,
  HasManyCreateAssociationMixin,
  HasManyGetAssociationsMixin,
} from 'sequelize';
import { sequelize } from '@/database';
import { User } from './user.model';
import { TestRun } from './testRun.model';

interface PipelineModel extends Model<InferAttributes<PipelineModel>, InferCreationAttributes<PipelineModel>> {
  // Properties
  id: CreationOptional<string>;
  name: string;
  description: CreationOptional<string>;
  type: 'jenkins' | 'github-actions' | 'custom';
  config: {
    url: string;
    credentials: {
      username: string;
      apiToken: string;
    };
    repository?: string;
    branch?: string;
    triggers?: Array<'push' | 'pull_request' | 'schedule' | 'manual'>;
    schedule?: string;
  };
  notifications?: {
    enabled: boolean;
    channels: Array<'slack' | 'email' | 'pushover'>;
    conditions: Array<'success' | 'failure' | 'started' | 'completed'>;
  };
  timeout: CreationOptional<number>;
  retryCount: CreationOptional<number>;
  tags: CreationOptional<string[]>;
  userId: string;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  user?: NonAttribute<User>;
  testRuns?: NonAttribute<TestRun[]>;
  createTestRun: HasManyCreateAssociationMixin<TestRun>;
  getTestRuns: HasManyGetAssociationsMixin<TestRun>;

  // Association counts
  testRunCount?: NonAttribute<number>;
}

class Pipeline extends Model<InferAttributes<PipelineModel>, InferCreationAttributes<PipelineModel>> implements PipelineModel {
  declare id: CreationOptional<string>;
  declare name: string;
  declare description: CreationOptional<string>;
  declare type: 'jenkins' | 'github-actions' | 'custom';
  declare config: {
    url: string;
    credentials: {
      username: string;
      apiToken: string;
    };
    repository?: string;
    branch?: string;
    triggers?: Array<'push' | 'pull_request' | 'schedule' | 'manual'>;
    schedule?: string;
  };
  declare notifications?: {
    enabled: boolean;
    channels: Array<'slack' | 'email' | 'pushover'>;
    conditions: Array<'success' | 'failure' | 'started' | 'completed'>;
  };
  declare timeout: CreationOptional<number>;
  declare retryCount: CreationOptional<number>;
  declare tags: CreationOptional<string[]>;
  declare userId: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare user?: NonAttribute<User>;
  declare testRuns?: NonAttribute<TestRun[]>;
  declare createTestRun: HasManyCreateAssociationMixin<TestRun>;
  declare getTestRuns: HasManyGetAssociationsMixin<TestRun>;

  // Association counts
  declare testRunCount?: NonAttribute<number>;

  // Static methods
  static associate(models: any): void {
    Pipeline.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });

    Pipeline.hasMany(models.TestRun, {
      foreignKey: 'pipelineId',
      as: 'testRuns',
    });
  }
}

Pipeline.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('jenkins', 'github-actions', 'custom'),
      allowNull: false,
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    notifications: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    timeout: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
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
    tableName: 'pipelines',
    modelName: 'Pipeline',
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['tags'],
        using: 'gin',
      },
    ],
  }
);

export { Pipeline };
export type PipelineAttributes = InferAttributes<PipelineModel>;
export type PipelineCreationAttributes = InferCreationAttributes<PipelineModel>;