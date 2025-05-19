import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  NonAttribute,
  Association,
  Sequelize
} from 'sequelize';
import { sequelize } from '@/database';

interface UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  // Properties
  id: CreationOptional<string>;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  refreshToken: CreationOptional<string | null>;
  passwordResetToken: CreationOptional<string | null>;
  passwordResetExpires: CreationOptional<Date | null>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;

  // Virtual fields
  fullName: NonAttribute<string>;
}

class User extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> implements UserModel {
  declare id: CreationOptional<string>;
  declare email: string;
  declare password: string;
  declare firstName: string;
  declare lastName: string;
  declare role: 'admin' | 'user';
  declare refreshToken: CreationOptional<string | null>;
  declare passwordResetToken: CreationOptional<string | null>;
  declare passwordResetExpires: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Virtual fields
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Static methods
  static associate(models: any): void {
    // Define associations here when needed
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user',
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: 'users',
    modelName: 'User',
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
    ],
    defaultScope: {
      attributes: { exclude: ['password', 'refreshToken', 'passwordResetToken', 'passwordResetExpires'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] },
      },
      withRefreshToken: {
        attributes: { include: ['refreshToken'] },
      },
      withResetToken: {
        attributes: { include: ['passwordResetToken', 'passwordResetExpires'] },
      },
    },
  }
);

// Hooks
User.beforeCreate(async (user: User) => {
  if (!user.id) {
    user.id = DataTypes.UUIDV4;
  }
});

export { User };
export type UserAttributes = InferAttributes<UserModel>;
export type UserCreationAttributes = InferCreationAttributes<UserModel>;