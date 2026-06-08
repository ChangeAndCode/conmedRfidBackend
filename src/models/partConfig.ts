import { Schema, model } from "mongoose";
import { gtinValuePattern } from "../utils/catalogValidation";

export const readingModes = ["manual", "single_scan", "double_scan"] as const;
export const expectedGtinPattern = gtinValuePattern;

export type ReadingMode = (typeof readingModes)[number];

export interface PartConfig {
    partNumber: string;
    description?: string;
    readingMode: ReadingMode;
    rfidProgram?: string;
    usesLegacyRfidPayload: boolean;
    legacyRfidPartNumber?: string;
    expectedGtin?: string;
    expectedLotLength?: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const removeLegacyLotTrimRight = (_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> => {
    delete ret.lotTrimRight;
    return ret;
};

const partConfigSchema = new Schema<PartConfig>(
    {
        partNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        description: {
            type: String,
            trim: true,
        },
        readingMode: {
            type: String,
            enum: readingModes,
            required: true,
        },
        rfidProgram: {
            type: String,
            trim: true,
            uppercase: true,
        },
        usesLegacyRfidPayload: {
            type: Boolean,
            default: false,
            required: true,
        },
        legacyRfidPartNumber: {
            type: String,
            trim: true,
        },
        expectedGtin: {
            type: String,
            trim: true,
            validate: {
                validator: (value: string | undefined): boolean => {
                    return value === undefined || expectedGtinPattern.test(value);
                },
                message: "El campo expectedGtin debe contener exactamente 14 digitos numericos",
            },
        },
        expectedLotLength: {
            type: Number,
            min: 1,
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
        toJSON: {
            transform: removeLegacyLotTrimRight,
        },
        toObject: {
            transform: removeLegacyLotTrimRight,
        },
    }
);

partConfigSchema.index({ partNumber: 1 }, { unique: true });
partConfigSchema.index({ readingMode: 1, isActive: 1, partNumber: 1 });
partConfigSchema.index({ expectedGtin: 1, readingMode: 1, isActive: 1 });
partConfigSchema.index({ usesLegacyRfidPayload: 1, legacyRfidPartNumber: 1 });

export const PartConfigModel = model<PartConfig>("PartConfig", partConfigSchema);
