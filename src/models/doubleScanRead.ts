import { Schema, model } from "mongoose";

export const doubleScanReadStatuses = ["captured", "programmed", "verified"] as const;

export type DoubleScanReadStatus = (typeof doubleScanReadStatuses)[number];

interface BarcodeFields {
    ai01?: string;
    ai10?: string;
    ai11?: string;
}

export interface DoubleScanRead {
    serviceOrderId?: string;
    partConfigId: string;
    serviceOrder?: string;
    partNumber: string;
    rfidProgram: string;
    filterLabel?: string;
    firstBarcodeRaw: string;
    secondBarcodeRaw: string;
    firstScanFields: BarcodeFields;
    secondScanFields: BarcodeFields;
    gtin: string;
    lot: string;
    manufactureDate: string;
    rulesApplied: string[];
    notes?: string;
    createdBy?: string;
    inputMethod: "double_scan";
    status: DoubleScanReadStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

const barcodeFieldsSchema = new Schema<BarcodeFields>(
    {
        ai01: {
            type: String,
            trim: true,
        },
        ai10: {
            type: String,
            trim: true,
        },
        ai11: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const doubleScanReadSchema = new Schema<DoubleScanRead>(
    {
        serviceOrderId: {
            type: String,
            required: true,
            trim: true,
        },
        partConfigId: {
            type: String,
            required: true,
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
            required: true,
            trim: true,
            uppercase: true,
        },
        filterLabel: {
            type: String,
            trim: true,
        },
        firstBarcodeRaw: {
            type: String,
            required: true,
            trim: true,
        },
        secondBarcodeRaw: {
            type: String,
            required: true,
            trim: true,
        },
        firstScanFields: {
            type: barcodeFieldsSchema,
            required: true,
        },
        secondScanFields: {
            type: barcodeFieldsSchema,
            required: true,
        },
        gtin: {
            type: String,
            required: true,
            trim: true,
        },
        lot: {
            type: String,
            required: true,
            trim: true,
        },
        manufactureDate: {
            type: String,
            required: true,
            trim: true,
        },
        rulesApplied: {
            type: [String],
            required: true,
            default: [],
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
            enum: ["double_scan"],
            default: "double_scan",
            required: true,
        },
        status: {
            type: String,
            enum: doubleScanReadStatuses,
            default: "captured",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

doubleScanReadSchema.index({ partNumber: 1, gtin: 1, lot: 1, manufactureDate: 1 });
doubleScanReadSchema.index({ serviceOrder: 1, createdAt: -1 });
doubleScanReadSchema.index({ serviceOrderId: 1, createdAt: -1 });
doubleScanReadSchema.index({ partConfigId: 1, createdAt: -1 });

export const DoubleScanReadModel = model<DoubleScanRead>("DoubleScanRead", doubleScanReadSchema);
