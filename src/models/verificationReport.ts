import { Schema, model } from "mongoose";
import { ServiceOrderReadingMode, serviceOrderReadingModes } from "./serviceOrder";

export const verificationReportStatuses = ["generated", "print_interrupted", "printed", "reprinted"] as const;
export const verificationReportHistoryEventTypes = ["generated", "print_interrupted", "printed", "reprinted"] as const;

export type VerificationReportStatus = (typeof verificationReportStatuses)[number];
export type VerificationReportHistoryEventType = (typeof verificationReportHistoryEventTypes)[number];

export interface VerificationReportRow {
    programmingRecordId: string;
    programmedAt: Date;
    verifiedAt: Date;
}

export interface VerificationReportHistoryEvent {
    type: VerificationReportHistoryEventType;
    occurredAt: Date;
    performedByUserId?: string;
    performedByUsername?: string;
    notes?: string;
}

export interface VerificationReport {
    serviceOrderId: string;
    serviceOrderFolio: string;
    serviceOrderReadingMode: ServiceOrderReadingMode;
    quantity: number;
    partNumber: string;
    lot: string;
    manufactureDate: string;
    manufacturingRepresentativeName: string;
    qualityRepresentativeName: string;
    rows: VerificationReportRow[];
    status: VerificationReportStatus;
    history: VerificationReportHistoryEvent[];
    generatedByUserId?: string;
    generatedByUsername?: string;
    lastPrintedAt?: Date;
    lastPrintInterruptedAt?: Date;
    lastReprintedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const verificationReportRowSchema = new Schema<VerificationReportRow>(
    {
        programmingRecordId: {
            type: String,
            required: true,
            trim: true,
        },
        programmedAt: {
            type: Date,
            required: true,
        },
        verifiedAt: {
            type: Date,
            required: true,
        },
    },
    {
        _id: false,
    }
);

const verificationReportHistoryEventSchema = new Schema<VerificationReportHistoryEvent>(
    {
        type: {
            type: String,
            enum: verificationReportHistoryEventTypes,
            required: true,
        },
        occurredAt: {
            type: Date,
            required: true,
        },
        performedByUserId: {
            type: String,
            trim: true,
        },
        performedByUsername: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const verificationReportSchema = new Schema<VerificationReport>(
    {
        serviceOrderId: {
            type: String,
            required: true,
            trim: true,
        },
        serviceOrderFolio: {
            type: String,
            required: true,
            trim: true,
        },
        serviceOrderReadingMode: {
            type: String,
            enum: serviceOrderReadingModes,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        partNumber: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
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
        manufacturingRepresentativeName: {
            type: String,
            required: true,
            trim: true,
        },
        qualityRepresentativeName: {
            type: String,
            required: true,
            trim: true,
        },
        rows: {
            type: [verificationReportRowSchema],
            required: true,
            validate: {
                validator: (value: VerificationReportRow[]): boolean => Array.isArray(value) && value.length > 0,
                message: "El reporte debe contener al menos un registro verificado",
            },
        },
        status: {
            type: String,
            enum: verificationReportStatuses,
            default: "generated",
            required: true,
        },
        history: {
            type: [verificationReportHistoryEventSchema],
            default: [],
        },
        generatedByUserId: {
            type: String,
            trim: true,
        },
        generatedByUsername: {
            type: String,
            trim: true,
        },
        lastPrintedAt: {
            type: Date,
        },
        lastPrintInterruptedAt: {
            type: Date,
        },
        lastReprintedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

verificationReportSchema.index({ serviceOrderId: 1 }, { unique: true });
verificationReportSchema.index({ serviceOrderFolio: 1 });
verificationReportSchema.index({ status: 1, createdAt: -1 });

export const VerificationReportModel = model<VerificationReport>("VerificationReport", verificationReportSchema);
