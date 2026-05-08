import { Schema, model } from "mongoose";

export const readingModes = ["manual", "single_scan", "double_scan"] as const;
export const expectedGtinPattern = /^\d{14}$/;

export type ReadingMode = (typeof readingModes)[number];

export interface PartConfig {
    partNumber: string;
    description?: string;
    readingMode: ReadingMode;
    rfidProgram?: string;
    expectedGtin?: string;
    filterLabel?: string;
    expectedLotLength?: number;
    isActive: boolean;
    notes?: string;
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
        filterLabel: {
            type: String,
            trim: true,
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
        notes: {
            type: String,
            trim: true,
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

export const PartConfigModel = model<PartConfig>("PartConfig", partConfigSchema);
