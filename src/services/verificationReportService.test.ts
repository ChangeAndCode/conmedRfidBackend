import assert from "node:assert/strict";
import test from "node:test";
import { ServiceOrderModel } from "../models/serviceOrder";
import {
    VerificationReport,
    VerificationReportHistoryEvent,
    VerificationReportModel,
} from "../models/verificationReport";
import {
    markVerificationReportAsPrinted,
    markVerificationReportPrintInterrupted,
} from "./verificationReportService";

type RestoreFn = () => void;

type VerificationReportDocument = VerificationReport & {
    _id: string;
    history: VerificationReportHistoryEvent[];
    save: () => Promise<VerificationReportDocument>;
};

type ServiceOrderDocument = {
    _id: string;
    folio: string;
    readingMode: "single_scan";
    quantity: number;
    status: "open" | "blocked" | "closed";
    save: () => Promise<ServiceOrderDocument>;
};

const stubMethod = <T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]): RestoreFn => {
    const original = target[key];
    Object.assign(target, { [key]: replacement });

    return () => {
        Object.assign(target, { [key]: original });
    };
};

const createFixture = (
    reportStatus: "generated" | "print_interrupted" | "printed" | "reprinted",
    serviceOrderStatus: "open" | "blocked" | "closed"
): {
    serviceOrder: ServiceOrderDocument;
    verificationReport: VerificationReportDocument;
} => {
    const serviceOrder: ServiceOrderDocument = {
        _id: "so1",
        folio: "SO-1",
        readingMode: "single_scan",
        quantity: 1,
        status: serviceOrderStatus,
        save: async () => serviceOrder,
    };
    const verificationReport: VerificationReportDocument = {
        _id: "vr1",
        serviceOrderId: "so1",
        serviceOrderFolio: "SO-1",
        serviceOrderReadingMode: "single_scan",
        quantity: 1,
        partNumber: "C32-25-001",
        lot: "42",
        manufactureDate: "250101",
        manufacturingRepresentativeName: "Manufactura",
        qualityRepresentativeName: "Calidad",
        rows: [{
            programmingRecordId: "pr1",
            programmedAt: new Date("2026-06-01T00:00:00.000Z"),
            verifiedAt: new Date("2026-06-01T00:05:00.000Z"),
        }],
        status: reportStatus,
        history: [],
        save: async () => verificationReport,
    };

    return {
        serviceOrder,
        verificationReport,
    };
};

test("markVerificationReportPrintInterrupted blocks the service order", async () => {
    const fixture = createFixture("generated", "closed");
    const restores: RestoreFn[] = [
        stubMethod(
            VerificationReportModel,
            "findById",
            (async () => fixture.verificationReport) as typeof VerificationReportModel.findById
        ),
        stubMethod(
            ServiceOrderModel,
            "findById",
            (async () => fixture.serviceOrder) as typeof ServiceOrderModel.findById
        ),
    ];

    try {
        const result = await markVerificationReportPrintInterrupted({
            verificationReportId: "vr1",
            actor: {
                username: "estacion-verificacion",
            },
            notes: "impresora sin tinta",
        });

        assert.equal(result.status, "print_interrupted");
        assert.equal(fixture.serviceOrder.status, "blocked");
        assert.equal(result.history.length, 1);
        assert.equal(result.history[0]?.type, "print_interrupted");
        assert.equal(result.history[0]?.performedByUsername, "estacion-verificacion");
        assert.equal(result.history[0]?.notes, "impresora sin tinta");
    } finally {
        restores.reverse().forEach((restore) => restore());
    }
});

test("public station cannot complete an interrupted report", async () => {
    const fixture = createFixture("print_interrupted", "blocked");
    const restores: RestoreFn[] = [
        stubMethod(
            VerificationReportModel,
            "findById",
            (async () => fixture.verificationReport) as typeof VerificationReportModel.findById
        ),
        stubMethod(
            ServiceOrderModel,
            "findById",
            (async () => fixture.serviceOrder) as typeof ServiceOrderModel.findById
        ),
    ];

    try {
        await assert.rejects(
            () => markVerificationReportAsPrinted({
                verificationReportId: "vr1",
                actor: {
                    username: "estacion-verificacion",
                },
                source: "public-station",
            }),
            new Error("El reporte con impresion interrumpida debe completarse desde el dashboard del supervisor")
        );
        assert.equal(fixture.verificationReport.status, "print_interrupted");
        assert.equal(fixture.serviceOrder.status, "blocked");
    } finally {
        restores.reverse().forEach((restore) => restore());
    }
});

test("supervisor can complete an interrupted report and close the service order again", async () => {
    const fixture = createFixture("print_interrupted", "blocked");
    const restores: RestoreFn[] = [
        stubMethod(
            VerificationReportModel,
            "findById",
            (async () => fixture.verificationReport) as typeof VerificationReportModel.findById
        ),
        stubMethod(
            ServiceOrderModel,
            "findById",
            (async () => fixture.serviceOrder) as typeof ServiceOrderModel.findById
        ),
    ];

    try {
        const result = await markVerificationReportAsPrinted({
            verificationReportId: "vr1",
            actor: {
                username: "supervisor",
            },
            notes: "impresion confirmada en dashboard",
        });

        assert.equal(result.status, "printed");
        assert.equal(fixture.serviceOrder.status, "closed");
        assert.equal(result.history.length, 1);
        assert.equal(result.history[0]?.type, "printed");
        assert.equal(result.history[0]?.performedByUsername, "supervisor");
        assert.equal(result.history[0]?.notes, "impresion confirmada en dashboard");
    } finally {
        restores.reverse().forEach((restore) => restore());
    }
});
