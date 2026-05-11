import { Schema, model } from "mongoose";

export const manualReadStatuses = ["captured", "programmed", "verified"] as const;

export type ManualReadStatus = (typeof manualReadStatuses)[number];

export interface ManualRead {
    serviceOrderId?: string;
    serviceOrder?: string;
    partNumber: string;
    rfidProgram?: string;
    gtin?: string;
    lot?: string;
    manufactureDate?: string;
    filterLabel?: string;
    rawReference?: string;
    notes?: string;
    createdBy?: string;
    inputMethod: "manual";
    status: ManualReadStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

const manualReadSchema = new Schema<ManualRead>(
    {
        serviceOrderId: {
            type: String,
            trim: true,
        },
        serviceOrder: {
            type: String,
            trim: true,
        },
        partNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        rfidProgram: {
            type: String,
            trim: true,
            uppercase: true,
        },
        gtin: {
            type: String,
            trim: true,
        },
        lot: {
            type: String,
            trim: true,
        },
        manufactureDate: {
            type: String,
            trim: true,
        },
        filterLabel: {
            type: String,
            trim: true,
        },
        rawReference: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
            trim: true,
        },
        createdBy: {
            type: String,
            trim: true,
        },
        inputMethod: {
            type: String,
            enum: ["manual"],
            default: "manual",
            required: true,
        },
        status: {
            type: String,
            enum: manualReadStatuses,
            default: "captured",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

manualReadSchema.index({ partNumber: 1, lot: 1, manufactureDate: 1 });
manualReadSchema.index({ serviceOrder: 1, createdAt: -1 });
manualReadSchema.index({ serviceOrderId: 1, createdAt: -1 });

export const ManualReadModel = model<ManualRead>("ManualRead", manualReadSchema);
