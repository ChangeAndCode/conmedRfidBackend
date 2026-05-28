# RFID Legacy Payload

Este backend porta la estructura legada usada por el software histórico de programación RFID.

## Bloque lógico

- Longitud total: `48 bytes`
- Representación interna: `96 caracteres hex`
- Relleno por defecto: `0x20` por byte

## Layout

- Bytes `0-1`: `AuthCode`
- Bytes `2-3`: `InitialLife` con bytes invertidos
- Bytes `4-5`: `RemainingLife #1` con bytes invertidos
- Bytes `6-7`: `RemainingLifeXor #1`
- Bytes `8-9`: `RemainingLife #2` con bytes invertidos
- Bytes `10-11`: `RemainingLifeXor #2`
- Bytes `12-21`: `PartNo` en ASCII, máximo `10 bytes`
- Bytes `22-29`: `LotNo` numérico en hex, `8 bytes`
- Bytes `30-37`: `DateCode` en ASCII, máximo `8 bytes`
- Bytes `38-39`: reservado, actualmente `0x20 0x20`
- Bytes `40-47`: `FilterReset`, actualmente ASCII `"00000000"`

## Endpoint temporal

`POST /api/rfid/build-payload`

Body mínimo:

```json
{
  "partNumber": "EMVS353",
  "lot": "12345678",
  "dateCode": "240101",
  "tagId": "E00401004F123456"
}
```

Por defecto, `partNumber` se resuelve contra `part-config`:

- `partNumber` = número de parte del backend
- `usesLegacyRfidPayload` debe estar en `true`
- `legacyRfidPartNumber` debe existir y contener el valor exacto a grabar en el payload legado

Si necesitas probar un nombre legado sin configurar `part-config`, puedes enviar `legacyRfidPartNumber` explícitamente en el request.

También acepta aliases:

- `partNo`
- `lotNo`
- `manufactureDate` como alias directo de `dateCode`
- `legacyRfidPartNumber` para override temporal del valor legado

## Restricciones actuales

- `partNumber` debe caber en `10 bytes ASCII`
- `lot` debe ser numérico para respetar el layout legado
- `dateCode` debe caber en `8 bytes ASCII`
- `tagId` debe venir como hex válido
