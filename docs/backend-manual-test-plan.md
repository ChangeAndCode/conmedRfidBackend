# Backend Manual Test Plan

Este plan valida el backend por pasos tangibles, sin depender del frontend.

## Preparacion

- Backend corriendo en `http://localhost:3000`
- Base de datos accesible
- Usar PowerShell

Variables recomendadas:

```powershell
$baseUrl = "http://localhost:3000/api"
$adminToken = ""
$supervisorToken = ""
$manualServiceOrderId = ""
$singleScanServiceOrderId = ""
$doubleServiceOrderId = ""
$manualChangeRequestId = ""
$doubleChangeRequestId = ""
$doubleScanPartConfigId = ""
```

## Paso 1. Crear primer admin

Este paso solo funciona una vez por base de datos vacia.

```powershell
$adminRegisterBody = @{
  username = "admin1"
  email = "admin1@conmed.com"
  password = "12345678"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/auth/register" `
  -ContentType "application/json" `
  -Body $adminRegisterBody
```

Resultado esperado:

- responde `201`
- el usuario queda con rol `admin`

## Paso 2. Login admin

```powershell
$adminLoginBody = @{
  email = "admin1@conmed.com"
  password = "12345678"
} | ConvertTo-Json

$adminLogin = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/auth/login" `
  -ContentType "application/json" `
  -Body $adminLoginBody

$adminToken = $adminLogin.data.token
$adminToken
```

Resultado esperado:

- responde `200`
- regresa `token`
- `data.user.role` debe ser `admin`

## Paso 3. Crear supervisor desde admin

```powershell
$supervisorRegisterBody = @{
  username = "supervisor1"
  email = "supervisor1@conmed.com"
  password = "12345678"
  role = "supervisor"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/auth/register" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -ContentType "application/json" `
  -Body $supervisorRegisterBody
```

Resultado esperado:

- responde `201`
- el usuario queda con rol `supervisor`

## Paso 4. Login supervisor y perfil

```powershell
$supervisorLoginBody = @{
  email = "supervisor1@conmed.com"
  password = "12345678"
} | ConvertTo-Json

$supervisorLogin = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/auth/login" `
  -ContentType "application/json" `
  -Body $supervisorLoginBody

$supervisorToken = $supervisorLogin.data.token

Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/auth/me" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }
```

Resultado esperado:

- `data.user.role` debe ser `supervisor`

## Paso 5. Permisos

### 5.1 Admin si puede entrar a catalogos

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/gtins" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Resultado esperado:

- responde `200`

### 5.2 Supervisor si puede leer catalogos para crear ordenes

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/gtins" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }

Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/rfid-programs" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }

Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/part-configs?readingMode=manual&isActive=true" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }
```

Resultado esperado:

- responde `200`
- puede leer opciones, pero no administrarlas

### 5.3 Supervisor no puede crear catalogos

```powershell
$gtinBodySupervisor = @{
  value = "12345678901234"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/gtins" `
  -Headers @{ Authorization = "Bearer $supervisorToken" } `
  -ContentType "application/json" `
  -Body $gtinBodySupervisor
```

Resultado esperado:

- responde `403`

### 5.4 Supervisor si puede entrar a service orders

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }
```

Resultado esperado:

- responde `200`

### 5.5 Admin no puede entrar a service orders

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Resultado esperado:

- responde `403`

## Paso 6. Crear catalogos base con admin

### 6.1 Crear GTIN

```powershell
$gtinBody = @{
  value = "00851136001566"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/gtins" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -ContentType "application/json" `
  -Body $gtinBody
```

### 6.2 Crear RFID Program

```powershell
$rfidProgramBody = @{
  value = "VSXLL01"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/rfid-programs" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -ContentType "application/json" `
  -Body $rfidProgramBody
```

Resultado esperado:

- ambos responden `201`
- si ya existen puede responder conflicto por duplicado

## Paso 7. Crear orden manual con supervisor

Usa un `partNumber` manual sembrado por defecto, por ejemplo `EMVS353`.

```powershell
$manualServiceOrderBody = @{
  readingMode = "manual"
  partNumber = "EMVS353"
  quantity = 50
  notes = "orden manual de prueba"
} | ConvertTo-Json

$manualServiceOrderResponse = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/service-orders" `
  -Headers @{ Authorization = "Bearer $supervisorToken" } `
  -ContentType "application/json" `
  -Body $manualServiceOrderBody

$manualServiceOrderId = $manualServiceOrderResponse.data._id
$manualServiceOrderId
```

Resultado esperado:

- responde `201`
- genera un `folio` automatico con formato `MLYYYYMMDDHHMMSS`
- guarda `readingMode = manual`
- guarda `partNumber = EMVS353`
- no requiere `gtin`

### 7.0 Confirmar progreso inicial de la orden manual

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$manualServiceOrderId" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }
```

Resultado esperado:

- responde `200`
- `data.quantity` debe coincidir con la orden creada
- `data.programmedCount` debe ser `0`
- `data.verifiedCount` debe ser `0`
- `data.remainingToProgram` debe ser igual a `data.quantity`
- `data.remainingToVerify` debe ser igual a `data.quantity`

## Paso 7.1 Crear orden single scan con supervisor

Usa un `partNumber` configurado como `single_scan`. Si todavia no existe uno, crea antes una `part-config`
activa con `readingMode = single_scan`.

```powershell
$singleScanServiceOrderBody = @{
  readingMode = "single_scan"
  partNumber = "SEA3700-SGL"
  quantity = 25
  notes = "orden single scan de prueba"
} | ConvertTo-Json

$singleScanServiceOrderResponse = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/service-orders" `
  -Headers @{ Authorization = "Bearer $supervisorToken" } `
  -ContentType "application/json" `
  -Body $singleScanServiceOrderBody

$singleScanServiceOrderId = $singleScanServiceOrderResponse.data._id
$singleScanServiceOrderId
```

Resultado esperado:

- responde `201`
- genera un `folio` automatico con formato `LSYYYYMMDDHHMMSS`
- guarda `readingMode = single_scan`
- guarda el `partNumber` configurado
- si la `part-config` single scan tiene `rfidProgram`, el backend puede heredarlo

## Paso 8. Crear orden de doble codigo con supervisor

```powershell
$doubleServiceOrderBody = @{
  readingMode = "double_scan"
  gtin = "00851136001566"
  quantity = 100
  rfidProgram = "VSXLL01"
  notes = "orden doble codigo de prueba"
} | ConvertTo-Json

$doubleServiceOrderResponse = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/service-orders" `
  -Headers @{ Authorization = "Bearer $supervisorToken" } `
  -ContentType "application/json" `
  -Body $doubleServiceOrderBody

$doubleServiceOrderId = $doubleServiceOrderResponse.data._id
$doubleServiceOrderId
```

Resultado esperado:

- responde `201`
- genera un `folio` automatico con formato `DLYYYYMMDDHHMMSS`
- guarda `readingMode = double_scan`
- guarda `gtin`
- guarda `rfidProgram`

## Paso 9. Resolver ordenes para cada flujo

### 9.1 Resolver orden manual por numero de parte

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/resolve-by-part-number?partNumber=EMVS353"
```

Resultado esperado:

- responde `200`
- regresa la orden manual creada para `EMVS353`

### 9.1.1 Resolver orden single scan por numero de parte

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/resolve-by-part-number?partNumber=SEA3700-SGL&readingMode=single_scan"
```

Resultado esperado:

- responde `200`
- regresa la orden single scan creada para `SEA3700-SGL`

### 9.2 Resolver orden doble por GTIN

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/resolve-by-gtin?gtin=00851136001566"
```

Resultado esperado:

- responde `200`
- regresa la orden double scan creada para el `GTIN` consultado

## Paso 10. Obtener opciones de numero de parte

### 10.1 Orden manual

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$manualServiceOrderId/part-config-options"
```

Resultado esperado:

- responde `200`
- regresa solo la opcion del `partNumber` manual configurado

### 10.1.1 Orden single scan

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$singleScanServiceOrderId/part-config-options"
```

Resultado esperado:

- responde `200`
- regresa solo la opcion del `partNumber` single scan configurado

## Paso 10.2 Resolver lectura single scan por codigo GS1

Codigo GS1 de ejemplo:

- `0120845854081720112209011020220`
- AI `01` => GTIN `20845854081720`
- AI `11` => fecha `220901`
- AI `10` => lote `20220`

```powershell
$singleScanResolveBody = @{
  rawScan = "0120845854081720112209011020220"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/single-scan-reads/resolve" `
  -ContentType "application/json" `
  -Body $singleScanResolveBody
```

Resultado esperado:

- responde `200`
- regresa `gtin`, `lot` y `manufactureDate` parseados desde el GS1
- regresa `matchingServiceOrders`
- si hay varias ordenes `single_scan` abiertas con el mismo `GTIN`, todas deben venir en la respuesta

### 10.2.1 Resolver ordenes single scan abiertas por GTIN

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/resolve-by-gtin?gtin=20845854081720&readingMode=single_scan"
```

Resultado esperado:

- responde `200`
- regresa solo ordenes `single_scan` abiertas para ese `GTIN`

### 10.2.2 Registrar lectura single scan ligada a orden single scan

```powershell
$singleScanReadBody = @{
  serviceOrderId = $singleScanServiceOrderId
  partNumber = "SEA3700-SGL"
  rawScan = "0120845854081720112209011020220"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/single-scan-reads" `
  -ContentType "application/json" `
  -Body $singleScanReadBody
```

Resultado esperado:

- responde `201`
- guarda `serviceOrderId`
- guarda el `folio` de la orden en `serviceOrder`
- guarda `readingMode = single_scan` en la orden relacionada
- toma `GTIN`, `lote` y `fecha de manufactura` desde el `rawScan`
- si la `part-config` single scan tiene `rfidProgram`, `expectedGtin` o `filterLabel`, el backend los hereda
- crea un `programming_record` con `status = programmed`

### 10.2.3 Caso negativo single scan

```powershell
$singleScanReadBodyInvalid = @{
  serviceOrderId = $singleScanServiceOrderId
  partNumber = "A84962"
  rawScan = "0120845854081720112209011020220"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/single-scan-reads" `
  -ContentType "application/json" `
  -Body $singleScanReadBodyInvalid
```

Resultado esperado:

- responde `400`
- indica que el numero de parte no esta configurado para single scan o no coincide con la orden

### 10.3 Orden de doble codigo

```powershell
$partConfigOptions = Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$doubleServiceOrderId/part-config-options"

$doubleScanPartConfigId = $partConfigOptions.data[0].id
$doubleScanPartConfigId
```

Resultado esperado:

- responde `200`
- regresa opciones de `partNumber` para ese `GTIN`
- debe incluir ids de `partConfig`

## Paso 11. Solicitud de cambio y bloqueo

### 11.1 Crear solicitud sobre la orden manual

```powershell
$changeRequestBody = @{
  requestType = "missing_product"
} | ConvertTo-Json

$manualChangeRequestResponse = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/service-orders/$manualServiceOrderId/change-requests" `
  -ContentType "application/json" `
  -Body $changeRequestBody

$manualChangeRequestId = $manualChangeRequestResponse.data._id
$manualChangeRequestId
```

Resultado esperado:

- responde `201`
- la orden manual cambia a `blocked`

### 11.2 Resolver la solicitud como supervisor

```powershell
$resolveManualChangeRequestBody = @{
  quantity = 55
  status = "open"
  resolutionNotes = "ajuste supervisor manual"
} | ConvertTo-Json

Invoke-RestMethod -Method Patch `
  -Uri "$baseUrl/service-orders/change-requests/$manualChangeRequestId/resolve" `
  -Headers @{ Authorization = "Bearer $supervisorToken" } `
  -ContentType "application/json" `
  -Body $resolveManualChangeRequestBody
```

Resultado esperado:

- responde `200`
- la solicitud queda `resolved`
- la orden vuelve a `open`

## Paso 12. Lectura manual ligada a orden manual

```powershell
$manualReadBody = @{
  serviceOrderId = $manualServiceOrderId
  partNumber = "EMVS353"
  rfidProgram = "EMVS353"
  lot = "MANUAL-LOT-001"
  manufactureDate = "240101"
  rawReference = "500322 A"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/manual-reads" `
  -ContentType "application/json" `
  -Body $manualReadBody
```

Resultado esperado:

- responde `201`
- la lectura guarda `serviceOrderId`
- la lectura guarda el `folio` en `serviceOrder`
- valida la orden por `partNumber`
- crea un `programming_record` con `status = programmed`

### 12.0 Confirmar avance despues de programar

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$manualServiceOrderId" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }
```

Resultado esperado:

- responde `200`
- `data.programmedCount` debe ser `1`
- `data.verifiedCount` debe seguir en `0`
- `data.remainingToProgram` debe disminuir en `1`
- `data.remainingToVerify` debe permanecer igual a `data.quantity`

### 12.1 Caso negativo manual

```powershell
$manualReadBodyInvalid = @{
  serviceOrderId = $manualServiceOrderId
  partNumber = "A84962"
  lot = "MANUAL-LOT-001"
  manufactureDate = "240101"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/manual-reads" `
  -ContentType "application/json" `
  -Body $manualReadBodyInvalid
```

Resultado esperado:

- responde `400`
- indica que el numero de parte no coincide con la orden

### 12.2 Caso de sobreprogramacion manual

Crea una orden manual adicional con `quantity = 2` y usa el mismo `partNumber = EMVS353`.
Registra dos lecturas manuales validas para esa orden y luego intenta una tercera.

```powershell
$manualLimitOrderBody = @{
  readingMode = "manual"
  partNumber = "EMVS353"
  quantity = 2
  notes = "orden manual para validar limite de programacion"
} | ConvertTo-Json

$manualLimitOrder = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/service-orders" `
  -Headers @{ Authorization = "Bearer $supervisorToken" } `
  -ContentType "application/json" `
  -Body $manualLimitOrderBody

$manualLimitOrderId = $manualLimitOrder.data._id

$manualLimitReadBody1 = @{
  serviceOrderId = $manualLimitOrderId
  partNumber = "EMVS353"
  rfidProgram = "EMVS353"
  lot = "MANUAL-LIMIT-001"
  manufactureDate = "240101"
  rawReference = "500322 LIMIT 1"
} | ConvertTo-Json

$manualLimitReadBody2 = @{
  serviceOrderId = $manualLimitOrderId
  partNumber = "EMVS353"
  rfidProgram = "EMVS353"
  lot = "MANUAL-LIMIT-002"
  manufactureDate = "240101"
  rawReference = "500322 LIMIT 2"
} | ConvertTo-Json

$manualLimitReadBody3 = @{
  serviceOrderId = $manualLimitOrderId
  partNumber = "EMVS353"
  rfidProgram = "EMVS353"
  lot = "MANUAL-LIMIT-003"
  manufactureDate = "240101"
  rawReference = "500322 LIMIT 3"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/manual-reads" `
  -ContentType "application/json" `
  -Body $manualLimitReadBody1

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/manual-reads" `
  -ContentType "application/json" `
  -Body $manualLimitReadBody2

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/manual-reads" `
  -ContentType "application/json" `
  -Body $manualLimitReadBody3
```

Resultado esperado:

- la primera y segunda lectura responden `201`
- la tercera lectura responde `409`
- el mensaje indica que la orden ya alcanzo la cantidad objetivo de programacion

Verificacion del progreso:

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$manualLimitOrderId" `
  -Headers @{ Authorization = "Bearer $supervisorToken" }
```

Resultado esperado:

- `data.programmedCount` debe ser `2`
- `data.remainingToProgram` debe ser `0`
- `data.verifiedCount` debe seguir en `0`

## Paso 13. Lectura doble ligada a orden doble

Codigos de ejemplo:

- primer codigo: `0100851136001566`
- segundo codigo: `1124010110LOT123456`

```powershell
$doubleScanBody = @{
  serviceOrderId = $doubleServiceOrderId
  partConfigId = $doubleScanPartConfigId
  firstBarcodeRaw = "0100851136001566"
  secondBarcodeRaw = "1124010110LOT123456"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/double-scan-reads" `
  -ContentType "application/json" `
  -Body $doubleScanBody
```

Resultado esperado:

- responde `201`
- valida orden por `gtin + rfidProgram`
- crea un `programming_record` con `status = programmed`

### 13.1 Caso negativo doble lectura

```powershell
$doubleScanBodyInvalid = @{
  serviceOrderId = $doubleServiceOrderId
  partConfigId = $doubleScanPartConfigId
  firstBarcodeRaw = "0100851136001566"
  secondBarcodeRaw = "1124010110BADLOT999"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/double-scan-reads" `
  -ContentType "application/json" `
  -Body $doubleScanBodyInvalid
```

Resultado esperado:

- si el `GTIN` o el `RFID program` no coinciden con la orden, responde `400`
- bloquea el guardado

## Paso 14. Resolver programaciones para verificacion

### 14.1 Confirmar programaciones pendientes

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/programming-records?status=programmed"
```

Resultado esperado:

- responde `200`
- regresa los `programming_records` creados en las lecturas manual, single scan y doble codigo
- cada record debe traer `status = programmed`

### 14.2 Resolver programacion manual por referencia

```powershell
$manualProgrammingResolveBody = @{
  mode = "manual"
  rawReference = "500322 A"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/resolve" `
  -ContentType "application/json" `
  -Body $manualProgrammingResolveBody
```

Resultado esperado:

- responde `200`
- `data.resolutionType` debe ser `single_match`
- `data.matchedBy` debe ser `manual_raw_reference`
- `data.candidates[0].serviceOrderFolio` debe coincidir con el folio automatico de la orden manual creada
- `data.candidates[0].partNumber` debe ser `EMVS353`

### 14.3 Resolver programacion single scan por GS1

```powershell
$singleProgrammingResolveBody = @{
  rawScan = "0120845854081720112209011020220"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/resolve" `
  -ContentType "application/json" `
  -Body $singleProgrammingResolveBody
```

Resultado esperado:

- responde `200`
- `data.matchedBy` debe ser `single_scan_raw` o `gs1_fields`
- `data.candidateCount` debe ser al menos `1`
- cada coincidencia debe traer `gtin`, `lot`, `manufactureDate`, `serviceOrderFolio` y `partNumber`
- si hay varias coincidencias validas, `data.resolutionType` debe ser `multiple_matches` y `autoSelectedProgrammingRecordId` debe ser `null`

### 14.4 Resolver programacion de doble codigo

```powershell
$doubleProgrammingResolveBody = @{
  firstBarcodeRaw = "0100851136001566"
  secondBarcodeRaw = "1124010110LOT123456"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/resolve" `
  -ContentType "application/json" `
  -Body $doubleProgrammingResolveBody
```

Resultado esperado:

- responde `200`
- `data.matchedBy` debe ser `double_scan_raw` o `gs1_fields`
- `data.candidateCount` debe ser al menos `1`
- cada coincidencia debe traer `serviceOrderId`, `serviceOrderFolio`, `partNumber`, `rfidProgram`, `gtin`, `lot` y `manufactureDate`

## Paso 15. Confirmar verificacion

### 15.1 Confirmar verificacion manual

Primero resuelve la programacion manual y toma el `_id` del primer candidato.

```powershell
$manualProgrammingRecordId = "<programmingRecordId-manual>"

$manualProgrammingVerifyBody = @{
  rawReference = "500322 A"
  verificationNotes = "verificacion manual de prueba"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/$manualProgrammingRecordId/verify" `
  -ContentType "application/json" `
  -Body $manualProgrammingVerifyBody
```

Resultado esperado:

- responde `200`
- `data.status` debe ser `verified`
- `data.verifiedAt` debe venir informado
- `data.verificationData.rawReference` debe ser `500322 A`
- `data.verificationMatchedBy` debe ser `manual_raw_reference`

### 15.2 Confirmar verificacion single scan

Primero resuelve la programacion single scan y toma el `_id` del candidato seleccionado.

```powershell
$singleProgrammingRecordId = "<programmingRecordId-single>"

$singleProgrammingVerifyBody = @{
  rawScan = "0120845854081720112209011020220"
  verificationNotes = "verificacion single scan de prueba"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/$singleProgrammingRecordId/verify" `
  -ContentType "application/json" `
  -Body $singleProgrammingVerifyBody
```

Resultado esperado:

- responde `200`
- `data.status` debe ser `verified`
- `data.verificationData.rawScan` debe venir informado
- `data.verificationMatchedBy` debe ser `single_scan_raw` o `gs1_fields`

### 15.3 Confirmar verificacion doble codigo

Primero resuelve la programacion double scan y toma el `_id` del candidato seleccionado.

```powershell
$doubleProgrammingRecordId = "<programmingRecordId-double>"

$doubleProgrammingVerifyBody = @{
  firstBarcodeRaw = "0100851136001566"
  secondBarcodeRaw = "1124010110LOT123456"
  verificationNotes = "verificacion doble codigo de prueba"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/$doubleProgrammingRecordId/verify" `
  -ContentType "application/json" `
  -Body $doubleProgrammingVerifyBody
```

Resultado esperado:

- responde `200`
- `data.status` debe ser `verified`
- `data.verificationData.firstBarcodeRaw` y `data.verificationData.secondBarcodeRaw` deben venir informados
- `data.verificationMatchedBy` debe ser `double_scan_raw` o `gs1_fields`

### 15.4 Validar consistencia despues de verificar

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/programming-records?status=verified"
```

Resultado esperado:

- responde `200`
- los `programming_records` verificados deben aparecer con `status = verified`
- la lectura origen relacionada en `manualreads`, `singlescanreads` o `doublescanreads` tambien debe quedar con `status = verified`

### 15.5 Caso negativo de evidencia que no coincide

```powershell
$manualProgrammingVerifyInvalidBody = @{
  rawReference = "REFERENCIA-INCORRECTA"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/programming-records/$manualProgrammingRecordId/verify" `
  -ContentType "application/json" `
  -Body $manualProgrammingVerifyInvalidBody
```

Resultado esperado:

- responde `409`
- indica que la evidencia de verificacion no coincide con el `programming_record` seleccionado
