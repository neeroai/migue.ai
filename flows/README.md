# WhatsApp Flows - Cobru.ai

Colección de flows de WhatsApp para wallet fintech colombiana.

## Estructura

| Flow | Archivo | Pantallas | Descripción |
|------|---------|-----------|-------------|
| Autenticación | `auth-pin.json` | 2 | PIN de 4 dígitos para verificación de identidad |
| Registro | `user-signup.json` | 4 | Creación de cuenta con datos personales y PIN |
| Transferencia | `bank-transfer.json` | 7 | Transferencias interbancarias con confirmación |
| Depósito | `deposit.json` | 7 | Múltiples métodos: transferencia, PSE, corresponsales |
| Retiro | `withdrawal.json` | 8 | Retiros a cuentas bancarias o efectivo |
| KYC | `kyc-verification.json` | 9 | Verificación de identidad SEDPE con documentos y selfie |
| Consulta de Saldo | `balance-check.json` | 2 | Visualización de saldos y acciones rápidas |
| Historial | `transaction-history.json` | 4 | Movimientos con filtros y detalles |

## Versiones

- Flow JSON: 7.3
- Data API: 3.0

## Uso

```bash
# Crear flow via API (draft)
curl -X POST \
  https://graph.facebook.com/v23.0/<WABA_ID>/flows \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d @flows/auth-pin.json
```

## Validación

```bash
# Validación estructural local (rápida, sin Meta)
npm run flows:validate

# Validación real en Meta (sube JSON al flow y consulta validation_errors)
WHATSAPP_TOKEN='<ACCESS_TOKEN>' \
npm run flows:validate:meta -- --file flows/auth-pin.json --flow-id <FLOW_ID> --api-version v23.0

# Validación + publish real en Meta
WHATSAPP_TOKEN='<ACCESS_TOKEN>' \
npm run flows:publish:meta -- --file flows/auth-pin.json --flow-id <FLOW_ID> --api-version v23.0
```

Notas:
- `flows:validate` no reemplaza la validación de Meta; solo detecta problemas obvios de estructura.
- `flows:validate:meta` y `flows:publish:meta` sí usan Graph API real.
- Recomendado ejecutar primero sobre un Flow draft de QA antes de producción.

## Componentes Utilizados

- TextHeading, TextSubheading, TextBody, TextCaption
- TextInput (text, email, phone, passcode, number)
- TextArea
- RadioButtonsGroup, CheckboxGroup, Dropdown
- DatePicker
- Form, Footer
- Image, PhotoPicker
- OptIn, Switch
- EmbeddedLink, NavigationList
- If (condicionales)

## Referencias

- Documentación Meta: https://developers.facebook.com/docs/whatsapp/flows/
- Flow JSON Reference: https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/
- Playground: https://developers.facebook.com/docs/whatsapp/flows/playground/
