import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association,
  Sequelize,
  BelongsToCreateAssociationMixin,
  BelongsToGetAssociationMixin,
} from 'sequelize';
import { sequelize } from '@/database';
import { Pipeline } from './pipeline.model';
import { User } from './user.model';

interface TestRunModel extends Model<InferAttributes<TestRunModel>, InferCreationAttributes<TestRunModel>> {
  // Properties
  id: CreationOptional<string>;
  pipelineId: string;
  userId: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'timeout';
  startTime: CreationOptional<Date>;
  endTime: CreationOptional<Date>;
  duration: CreationOptional<number>;
  branch: CreationOptional<string>;
  commit: CreationOptional<string>;
  parameters: CreationOptional<Record<string, any>>;
  results: CreationOptional<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    coverage?: number;
    reportUrl?: string;
  }>;
  logs: CreationOptional<string>;
  error: CreationOptional<string>;
  retryCount: CreationOptional<number>;
  priority: CreationOptional<'low' | 'medium' | 'high'>;
  tags: CreationOptional<string[]>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Associations
  pipeline?: NonAttribute<Pipeline>;
  user?: NonAttribute<User>;
  getPipeline: BelongsToGetAssociationMixin<Pipeline>;
  getUser: BelongsToGetAssociationMixin<User>;
}

class TestRun extends Model<InferAttributes<TestRunModel>, InferCreationAttributes<TestRunModel>> implements TestRunModel {
  declare id: CreationOptional<string>;
  declare pipelineId: string;
  declare userId: string;
  declare status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'timeout';
  declare startTime: CreationOptional<Date>;
  declare endTime: CreationOptional<Date>;
  declare duration: CreationOptional<number>;
  declare branch: CreationOptional<string>;
  declare commit: CreationOptional<string>;
  declare parameters: CreationOptional<Record<string, any>>;
  declare results: CreationOptional<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    coverage?: number;
    reportUrl?: string;
  }>;
  declare logs: CreationOptional<string>;
  declare error: CreationOptional<string>;
  declare retryCount: CreationOptional<number>;
  declare priority: CreationOptional<'low' | 'medium' | 'high'>;
  declare tags: CreationOptional<string[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Associations
  declare pipeline?: NonAttribute<Pipeline>;
  declare user?: NonAttribute<User>;
  declare getPipeline: BelongsToGetAssociationMixin<Pipeline>;
  declare getUser: BelongsToGetAssociationMixin<User>;

  // Static methods
  static associate(models: any): void {
    TestRun.belongsTo(models.Pipeline, {
      foreignKey: 'pipelineId',
      as: 'pipeline',
    });

    TestRun.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

TestRun.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    pipelineId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'pipelines',
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
    status: {
      type: DataTypes.ENUM('pending', 'running', 'success', 'failure', 'cancelled', 'timeout'),
      allowNull: false,
      defaultValue: 'pending',
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    branch: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    commit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parameters: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    results: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    logs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: true,
      defaultValue: 'medium',
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
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
    tableName: 'test_runs',
    modelName: 'TestRun',
    indexes: [
      {
        fields: ['pipelineId'],
      },
      {
        fields: ['userId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['tags'],
        using: 'gin',
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

// Hooks
TestRun.beforeCreate(async (testRun: TestRun) => {
  if (!testRun.id) {
    testRun.id = DataTypes.UUIDV4;
  }
});

TestRun.afterUpdate(async (testRun: TestRun) => {
  if (testRun.status === 'success' || testRun.status === 'failure') {
    testRun.endTime = new Date();
    if (testRun.startTime) {
      testRun.duration = Math.floor((testRun.endTime.getTime() - testRun.startTime.getTime()) / 1000);
    }
  }
});

export { TestRun };
export type TestRunAttributes = InferAttributes<TestRunModel>;
export type TestRunCreationAttributes = InferCreationAttributes<TestRunModel>;