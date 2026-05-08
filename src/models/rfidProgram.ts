import { Schema, model } from "mongoose";
import { rfidProgramMaxLength } from "../utils/catalogValidation";

export interface RfidProgram {
    value: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const rfidProgramSchema = new Schema<RfidProgram>(
    {
        value: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            validate: {
                validator: (value: string): boolean => value.length <= rfidProgramMaxLength,
                message: `El campo value no debe exceder ${rfidProgramMaxLength} caracteres`,
            },
        },
        isActive: {
            type: Boolean,
            default: true,
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

rfidProgramSchema.index({ value: 1 }, { unique: true });
rfidProgramSchema.index({ isActive: 1, value: 1 });

export const RfidProgramModel = model<RfidProgram>("RfidProgram", rfidProgramSchema);
