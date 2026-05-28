import assert from "node:assert/strict";
import test from "node:test";
import { buildLegacyTagPayload, calculateLegacyAuthCode, decodeLegacyTagPayload } from "./legacyTagCodec";

test("calculateLegacyAuthCode preserves known EMVS353 legacy result", () => {
    const authCode = calculateLegacyAuthCode("EMVS353", "E00401004F123456");

    assert.equal(authCode, "45B9");
});

test("buildLegacyTagPayload preserves known legacy payload layout", () => {
    const payload = buildLegacyTagPayload({
        dateCode: "240101",
        lot: "12345678",
        partNumber: "EMVS353",
        tagId: "E00401004F123456",
    });

    assert.equal(
        payload.payloadHex,
        "45B96810681097EF681097EF454D56533335332020200000000000BC614E323430313031202020203030303030303030"
    );
    assert.equal(payload.decoded.partNumber, "EMVS353");
    assert.equal(payload.decoded.lot, "12345678");
    assert.equal(payload.decoded.dateCode, "240101");
    assert.equal(payload.decoded.filterReset, "00000000");
    assert.equal(payload.decoded.initialLifeMinutes, 35 * 60);
    assert.equal(payload.decoded.remainingLife1Minutes, 35 * 60);
});

test("decodeLegacyTagPayload exposes the same values after a roundtrip", () => {
    const builtPayload = buildLegacyTagPayload({
        dateCode: "250101",
        lot: "42",
        partNumber: "STRYKEVAC",
        tagId: "E004010012345678",
    });
    const decoded = decodeLegacyTagPayload(builtPayload.payloadHex);

    assert.equal(decoded.authCode, "B297");
    assert.equal(decoded.partNumber, "STRYKEVAC");
    assert.equal(decoded.lot, "42");
    assert.equal(decoded.dateCode, "250101");
    assert.equal(decoded.initialLifeEncodedValue, 24 * 60 * 4);
    assert.equal(decoded.initialLifeMinutes, 24 * 60);
    assert.equal(decoded.remainingLife1Minutes, 24 * 60);
    assert.equal(decoded.remainingLifeXor1, "7FE9");
    assert.equal(decoded.remainingLifeXor2, "7FE9");
});

test("buildLegacyTagPayload rejects alphanumeric lot values in legacy mode", () => {
    assert.throws(
        () => buildLegacyTagPayload({
            dateCode: "240101",
            lot: "LOT-001",
            partNumber: "EMVS353",
            tagId: "E00401004F123456",
        }),
        /solo digitos/
    );
});

test("buildLegacyTagPayload rejects part numbers longer than 10 bytes", () => {
    assert.throws(
        () => buildLegacyTagPayload({
            dateCode: "240101",
            lot: "1",
            partNumber: "PARTNUMBER11",
            tagId: "E00401004F123456",
        }),
        /no puede exceder 10 caracteres/
    );
});
