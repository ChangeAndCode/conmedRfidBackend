import { Schema, model } from "mongoose";

export const singleScanReadStatuses = ["captured", "programmed", "verified"] as const;

export type SingleScanReadStatus = (typeof singleScanReadStatuses)[number];

export interface SingleScanRead {
    serviceOrderId?: string;
    serviceOrder?: string;
    partNumber: string;
    rfidProgram?: string;
    gtin?: string;
    lot?: string;
    manufactureDate?: string;
    rawScan: string;
    notes?: string;
    createdBy?: string;
    inputMethod: "single_scan";
    status: SingleScanReadStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

const singleScanReadSchema = new Schema<SingleScanRead>(
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
        rawScan: {
            type: String,
            required: true,
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
            enum: ["single_scan"],
            default: "single_scan",
            required: true,
        },
        status: {
            type: String,
            enum: singleScanReadStatuses,
            default: "captured",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

singleScanReadSchema.index({ partNumber: 1, lot: 1, manufactureDate: 1 });
singleScanReadSchema.index({ rawScan: 1, createdAt: -1 });
singleScanReadSchema.index({ serviceOrder: 1, createdAt: -1 });
singleScanReadSchema.index({ serviceOrderId: 1, createdAt: -1 });

export const SingleScanReadModel = model<SingleScanRead>("SingleScanRead", singleScanReadSchema);
