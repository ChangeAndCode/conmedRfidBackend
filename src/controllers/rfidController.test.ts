import assert from "node:assert/strict";
import test from "node:test";
import { buildLegacyTagPayload } from "../services/rfid/legacyTagCodec";
import { buildLegacyTagPayloadResponseData } from "./rfidController";

const buildSamplePayload = () => buildLegacyTagPayload({
    dateCode: "240101",
    lot: "12345678",
    partNumber: "EMVS353",
    tagId: "E00401004F123456",
});

const sampleLegacyPartMapping = {
    backendPartNumber: "EMVS353",
    legacyRfidPartNumber: "EMVS353",
    partConfigId: "6a02536363fa67a25a5bfe15",
    readingMode: "manual" as const,
    usesLegacyRfidPayload: true as const,
};

test("buildLegacyTagPayloadResponseData returns only operational fields by default", () => {
    const responseData = buildLegacyTagPayloadResponseData(
        buildSamplePayload(),
        "EMVS353",
        sampleLegacyPartMapping,
        false
    );

    assert.equal(responseData.authCode, "45B9");
    assert.equal(responseData.backendPartNumber, "EMVS353");
    assert.equal(responseData.partNumber, "EMVS353");
    assert.equal(responseData.payloadHex, "45B96810681097EF681097EF454D56533335332020200000000000BC614E323430313031202020203030303030303030");
    assert.equal(responseData.tagByteLength, 48);
    assert.equal("details" in responseData, false);
});

test("buildLegacyTagPayloadResponseData includes decoded details when verbose mode is enabled", () => {
    const responseData = buildLegacyTagPayloadResponseData(
        buildSamplePayload(),
        "EMVS353",
        sampleLegacyPartMapping,
        true
    );

    assert.ok(responseData.details);
    assert.equal(responseData.details.initialLifeMinutes, 35 * 60);
    assert.equal(responseData.details.remainingLifeMinutes, 35 * 60);
    assert.equal(responseData.details.decoded.partNumber, "EMVS353");
    assert.equal(responseData.details.decoded.lot, "12345678");
});
