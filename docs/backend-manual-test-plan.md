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
  folio = "SO-MAN-001"
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
- guarda `readingMode = manual`
- guarda `partNumber = EMVS353`
- no requiere `gtin`

## Paso 8. Crear orden de doble codigo con supervisor

```powershell
$doubleServiceOrderBody = @{
  folio = "SO-DBL-001"
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
- regresa la orden `SO-MAN-001`

### 9.2 Resolver orden doble por GTIN

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/resolve-by-gtin?gtin=00851136001566"
```

Resultado esperado:

- responde `200`
- regresa la orden `SO-DBL-001`

## Paso 10. Obtener opciones de numero de parte

### 10.1 Orden manual

```powershell
Invoke-RestMethod -Method Get `
  -Uri "$baseUrl/service-orders/$manualServiceOrderId/part-config-options"
```

Resultado esperado:

- responde `200`
- regresa solo la opcion del `partNumber` manual configurado

### 10.2 Orden de doble codigo

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
