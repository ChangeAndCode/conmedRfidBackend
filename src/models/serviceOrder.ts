import { Schema, model } from "mongoose";
import { gtinValuePattern, rfidProgramMaxLength } from "../utils/catalogValidation";

export const serviceOrderStatuses = ["open", "blocked", "closed"] as const;
export const serviceOrderReadingModes = ["manual", "double_scan"] as const;

export type ServiceOrderStatus = (typeof serviceOrderStatuses)[number];
export type ServiceOrderReadingMode = (typeof serviceOrderReadingModes)[number];

export interface ServiceOrder {
    folio: string;
    readingMode: ServiceOrderReadingMode;
    partNumber?: string;
    gtin?: string;
    rfidProgram?: string;
    quantity: number;
    status: ServiceOrderStatus;
    notes?: string;
    createdByUserId?: string;
    createdByUsername?: string;
    updatedByUserId?: string;
    updatedByUsername?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const serviceOrderSchema = new Schema<ServiceOrder>(
    {
        folio: {
            type: String,
            required: true,
            trim: true,
        },
        readingMode: {
            type: String,
            enum: serviceOrderReadingModes,
            required: true,
        },
        partNumber: {
            type: String,
            trim: true,
            uppercase: true,
        },
        gtin: {
            type: String,
            trim: true,
            validate: {
                validator: (value: string | undefined): boolean => value === undefined || gtinValuePattern.test(value),
                message: "El GTIN debe contener exactamente 14 digitos numericos",
            },
        },
        rfidProgram: {
            type: String,
            trim: true,
            uppercase: true,
            validate: {
                validator: (value: string | undefined): boolean => value === undefined || value.length <= rfidProgramMaxLength,
                message: `El RFID program no debe exceder ${rfidProgramMaxLength} caracteres`,
            },
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: (value: number): boolean => Number.isInteger(value),
                message: "La cantidad debe ser un entero positivo",
            },
        },
        status: {
            type: String,
            enum: serviceOrderStatuses,
            default: "open",
            required: true,
        },
        notes: {
            type: String,
            trim: true,
        },
        createdByUserId: {
            type: String,
            trim: true,
        },
        createdByUsername: {
            type: String,
            trim: true,
        },
        updatedByUserId: {
            type: String,
            trim: true,
        },
        updatedByUsername: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

serviceOrderSchema.index({ folio: 1 }, { unique: true });
serviceOrderSchema.index({ readingMode: 1, status: 1, createdAt: -1 });
serviceOrderSchema.index({ gtin: 1, readingMode: 1, status: 1, createdAt: -1 });
serviceOrderSchema.index({ partNumber: 1, readingMode: 1, status: 1, createdAt: -1 });

export const ServiceOrderModel = model<ServiceOrder>("ServiceOrder", serviceOrderSchema);
