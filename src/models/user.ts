import { Schema, model } from "mongoose";

export const userRoles = ["admin", "supervisor"] as const;

export type UserRole = (typeof userRoles)[number];

export interface User {
    username: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const userSchema = new Schema<User>(
    {
        username: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        passwordHash: {
            type: String,
            required: true,
            trim: true,
        },
        role: {
            type: String,
            enum: userRoles,
            default: "admin",
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            required: true,
        },
        lastLoginAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });

export const UserModel = model<User>("User", userSchema);
