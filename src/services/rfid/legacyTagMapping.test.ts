import assert from "node:assert/strict";
import test from "node:test";
import { resolveLegacyRfidPartMapping } from "./legacyTagMapping";

test("resolveLegacyRfidPartMapping returns the explicit legacy mapping when enabled", () => {
    const mapping = resolveLegacyRfidPartMapping({
        backendPartNumber: "VSXLLM01",
        legacyRfidPartNumber: "VSXLL01",
        usesLegacyRfidPayload: true,
    });

    assert.equal(mapping.backendPartNumber, "VSXLLM01");
    assert.equal(mapping.legacyRfidPartNumber, "VSXLL01");
    assert.equal(mapping.usesLegacyRfidPayload, true);
});

test("resolveLegacyRfidPartMapping rejects part numbers not enabled for legacy payload", () => {
    assert.throws(
        () => resolveLegacyRfidPartMapping({
            backendPartNumber: "SEA3700",
            usesLegacyRfidPayload: false,
        }),
        /no esta habilitado/
    );
});

test("resolveLegacyRfidPartMapping rejects missing explicit legacy mapping", () => {
    assert.throws(
        () => resolveLegacyRfidPartMapping({
            backendPartNumber: "EMVS353",
            usesLegacyRfidPayload: true,
        }),
        /legacyRfidPartNumber/
    );
});
