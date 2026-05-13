import { Schema, model } from "mongoose";

export const programmingRecordModes = ["manual", "single_scan", "double_scan"] as const;
export const programmingRecordSourceTypes = ["manual_read", "single_scan_read", "double_scan_read"] as const;
export const programmingRecordStatuses = ["captured", "programmed", "verified"] as const;

export type ProgrammingRecordMode = (typeof programmingRecordModes)[number];
export type ProgrammingRecordSourceType = (typeof programmingRecordSourceTypes)[number];
export type ProgrammingRecordStatus = (typeof programmingRecordStatuses)[number];

export interface ProgrammingRawSourceData {
    rawReference?: string;
    rawScan?: string;
    firstBarcodeRaw?: string;
    secondBarcodeRaw?: string;
}

export interface ProgrammingVerificationData {
    rawReference?: string;
    rawScan?: string;
    firstBarcodeRaw?: string;
    secondBarcodeRaw?: string;
}

export interface ProgrammingRecord {
    mode: ProgrammingRecordMode;
    sourceType: ProgrammingRecordSourceType;
    sourceReadId: string;
    serviceOrderId?: string;
    serviceOrderFolio?: string;
    partConfigId?: string;
    partNumber: string;
    rfidProgram?: string;
    gtin?: string;
    lot?: string;
    manufactureDate?: string;
    filterLabel?: string;
    rawSourceData: ProgrammingRawSourceData;
    verificationData?: ProgrammingVerificationData;
    verificationMatchedBy?: string;
    verificationNotes?: string;
    verifiedAt?: Date;
    notes?: string;
    createdBy?: string;
    status: ProgrammingRecordStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

const programmingRawSourceDataSchema = new Schema<ProgrammingRawSourceData>(
    {
        rawReference: {
            type: String,
            trim: true,
        },
        rawScan: {
            type: String,
            trim: true,
        },
        firstBarcodeRaw: {
            type: String,
            trim: true,
        },
        secondBarcodeRaw: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const programmingVerificationDataSchema = new Schema<ProgrammingVerificationData>(
    {
        rawReference: {
            type: String,
            trim: true,
        },
        rawScan: {
            type: String,
            trim: true,
        },
        firstBarcodeRaw: {
            type: String,
            trim: true,
        },
        secondBarcodeRaw: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const programmingRecordSchema = new Schema<ProgrammingRecord>(
    {
        mode: {
            type: String,
            enum: programmingRecordModes,
            required: true,
        },
        sourceType: {
            type: String,
            enum: programmingRecordSourceTypes,
            required: true,
        },
        sourceReadId: {
            type: String,
            required: true,
            trim: true,
        },
        serviceOrderId: {
            type: String,
            trim: true,
        },
        serviceOrderFolio: {
            type: String,
            trim: true,
        },
        partConfigId: {
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
        rawSourceData: {
            type: programmingRawSourceDataSchema,
            required: true,
            default: {},
        },
        verificationData: {
            type: programmingVerificationDataSchema,
            default: undefined,
        },
        verificationMatchedBy: {
            type: String,
            trim: true,
        },
        verificationNotes: {
            type: String,
            trim: true,
        },
        verifiedAt: {
            type: Date,
        },
        notes: {
            type: String,
            trim: true,
        },
        createdBy: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: programmingRecordStatuses,
            default: "programmed",
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

programmingRecordSchema.index({ sourceType: 1, sourceReadId: 1 }, { unique: true });
programmingRecordSchema.index({ mode: 1, createdAt: -1 });
programmingRecordSchema.index({ serviceOrderId: 1, createdAt: -1 });
programmingRecordSchema.index({ partNumber: 1, mode: 1, createdAt: -1 });
programmingRecordSchema.index({ gtin: 1, mode: 1, createdAt: -1 });
programmingRecordSchema.index({ rfidProgram: 1, mode: 1, createdAt: -1 });
programmingRecordSchema.index({ gtin: 1, lot: 1, manufactureDate: 1, createdAt: -1 });
programmingRecordSchema.index({ "rawSourceData.rawReference": 1, mode: 1, createdAt: -1 });
programmingRecordSchema.index({ "rawSourceData.rawScan": 1, createdAt: -1 });
programmingRecordSchema.index({ "rawSourceData.firstBarcodeRaw": 1, "rawSourceData.secondBarcodeRaw": 1, createdAt: -1 });

export const ProgrammingRecordModel = model<ProgrammingRecord>("ProgrammingRecord", programmingRecordSchema);
