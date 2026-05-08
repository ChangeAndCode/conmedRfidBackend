import { Schema, model } from "mongoose";
import { gtinValuePattern } from "../utils/catalogValidation";

export interface Gtin {
    value: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const gtinSchema = new Schema<Gtin>(
    {
        value: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: (value: string): boolean => gtinValuePattern.test(value),
                message: "El campo value debe contener exactamente 14 digitos numericos",
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

gtinSchema.index({ value: 1 }, { unique: true });
gtinSchema.index({ isActive: 1, value: 1 });

export const GtinModel = model<Gtin>("Gtin", gtinSchema);
