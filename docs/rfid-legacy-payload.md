# RFID Legacy Payload

Este backend porta la estructura legada usada por el software historico de programacion RFID.

## Bloque logico

- Longitud total: `48 bytes`
- Representacion interna: `96 caracteres hex`
- Relleno por defecto: `0x20` por byte

## Layout

- Bytes `0-1`: `AuthCode`
- Bytes `2-3`: `InitialLife` con bytes invertidos
- Bytes `4-5`: `RemainingLife #1` con bytes invertidos
- Bytes `6-7`: `RemainingLifeXor #1`
- Bytes `8-9`: `RemainingLife #2` con bytes invertidos
- Bytes `10-11`: `RemainingLifeXor #2`
- Bytes `12-21`: `PartNo` en ASCII, maximo `10 bytes`
- Bytes `22-29`: `LotNo` numerico en hex, `8 bytes`
- Bytes `30-37`: `DateCode` en ASCII, maximo `8 bytes`
- Bytes `38-39`: reservado, actualmente `0x20 0x20`
- Bytes `40-47`: `FilterReset`, actualmente ASCII `"00000000"`

## Endpoint temporal

`POST /api/rfid/build-payload`

Por defecto devuelve una respuesta compacta con los campos operativos:

- `backendPartNumber`
- `legacyPartMapping`
- `partNumber`
- `lot`
- `dateCode`
- `tagId`
- `authCode`
- `payloadHex`
- `tagByteLength`

Si necesitas la decodificacion detallada del payload y las vidas calculadas, usa:

- `POST /api/rfid/build-payload?verbose=true`
- `POST /api/rfid/build-payload?debug=true`

En ese modo agrega `details.decoded`, `details.initialLifeMinutes` y `details.remainingLifeMinutes`.

Body minimo:

```json
{
  "partNumber": "EMVS353",
  "lot": "12345678",
  "dateCode": "240101",
  "tagId": "E00401004F123456"
}
```

Por defecto, `partNumber` se resuelve contra `part-config`:

- `partNumber` = numero de parte del backend
- `usesLegacyRfidPayload` debe estar en `true`
- `legacyRfidPartNumber` debe existir y contener el valor exacto a grabar en el payload legado

Si necesitas probar un nombre legado sin configurar `part-config`, puedes enviar `legacyRfidPartNumber` explicitamente en el request.

Tambien acepta aliases:

- `partNo`
- `lotNo`
- `manufactureDate` como alias directo de `dateCode`
- `legacyRfidPartNumber` para override temporal del valor legado

## Restricciones actuales

- `partNumber` debe caber en `10 bytes ASCII`
- `lot` debe ser numerico para respetar el layout legado
- `dateCode` debe caber en `8 bytes ASCII`
- `tagId` debe venir como hex valido
