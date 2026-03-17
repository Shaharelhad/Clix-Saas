# Adding a New Integration Tool

The integration system works like **n8n nodes**: users connect credentials once in settings, then the service appears in the API call node with pre-built operations. No coding needed from the user — just fill in fields and wire the flow.

## How It Works

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Integration       │     │ Integration      │     │ Flow Execution   │
│ Catalog           │────▶│ Settings (UI)    │────▶│ (Backend)        │
│ (define service)  │     │ (user adds creds)│     │ (real API call)  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

1. **Catalog** defines the service: name, operations, input fields, response mappings
2. **User** adds credentials via the Integrations modal in Flow Builder
3. **Flow Builder** shows the service in the API call node dropdown with auto-generated forms
4. **Backend** executes real API calls using stored credentials + catalog definitions

## Files to Modify (per new service)

| # | File | What to add |
|---|------|-------------|
| 1 | `Client/src/types/integration-catalog.ts` | Service + operations definition |
| 2 | `supabase/functions/_shared/integration-catalog.ts` | Same definition (keep in sync) |
| 3 | `Client/src/i18n/locales/en/flow.ts` | English labels for all keys |
| 4 | `Client/src/i18n/locales/he/flow.ts` | Hebrew labels for all keys |
| 5 | Backend (`flow-demo/index.ts`, `flow-webhook/index.ts`) | Only if the service needs special auth or URL patterns |
| 6 | `FlowIntegrationsModal.tsx` | Only if the service needs a custom credential form |

## Catalog Structure

### ServiceDefinition

```typescript
{
  id: string,              // unique ID, e.g., "stripe"
  labelKey: string,        // i18n key for display name
  operations: OperationDefinition[]
}
```

### OperationDefinition

```typescript
{
  id: string,              // e.g., "listPayments"
  labelKey: string,        // i18n key for operation name
  descriptionKey: string,  // i18n key for description
  method: "GET" | "POST" | "PUT",
  endpointTemplate: string,  // URL path with {{placeholders}}
  bodyTemplate?: string,     // JSON body for POST/PUT
  inputFields: OperationInputField[],
  responseMapping: ResponseMapping[],
  errorMessageKey: string    // i18n key for error message
}
```

### OperationInputField

```typescript
{
  id: string,          // maps to {{placeholder}} in endpointTemplate
  labelKey: string,    // i18n key
  hintKey?: string,    // optional i18n hint
  required: boolean,
  type: "text" | "number" | "date",
  placeholder?: string // e.g., "{{variable_name}}"
}
```

### ResponseMapping

```typescript
{
  jsonPath: string,       // path in API response, e.g., "data[0].name"
  variableName: string,   // flow variable name, e.g., "product_name"
  labelKey: string        // i18n key for display in sidebar
}
```

## Cloudbeds Reference Example

### Catalog Entry

```typescript
// In INTEGRATION_CATALOG array:
{
  id: "cloudbeds",
  labelKey: "integrationCloudbeds",
  operations: [
    {
      id: "getAvailableRoomTypes",
      labelKey: "cloudbeds_opGetAvailableRooms",
      descriptionKey: "cloudbeds_opGetAvailableRoomsDesc",
      method: "GET",
      endpointTemplate: "/api/v1.2/getAvailableRoomTypes?propertyID={{propertyId}}&startDate={{startDate}}&endDate={{endDate}}&adults={{adults}}",
      inputFields: [
        { id: "startDate", labelKey: "cloudbeds_fieldCheckIn", hintKey: "cloudbeds_fieldDateHint", required: true, type: "text", placeholder: "{{checkin_date}}" },
        { id: "endDate",   labelKey: "cloudbeds_fieldCheckOut", hintKey: "cloudbeds_fieldDateHint", required: true, type: "text", placeholder: "{{checkout_date}}" },
        { id: "adults",    labelKey: "cloudbeds_fieldAdults", hintKey: "cloudbeds_fieldAdultsHint", required: true, type: "text", placeholder: "{{number_of_guests}}" },
      ],
      responseMapping: [
        { jsonPath: "data[0].propertyRooms[0].roomTypeName", variableName: "unit",     labelKey: "cloudbeds_varUnit" },
        { jsonPath: "data[0].propertyRooms[0].roomRate",     variableName: "price",    labelKey: "cloudbeds_varPrice" },
        { jsonPath: "data[0].propertyCurrency.currencySymbol", variableName: "currency", labelKey: "cloudbeds_varCurrency" },
      ],
      errorMessageKey: "cloudbeds_errorGetAvailableRooms",
    }
  ]
}
```

### i18n Keys (English)

```typescript
// In Client/src/i18n/locales/en/flow.ts:
integrationCloudbeds: "Cloudbeds",
cloudbeds_opGetAvailableRooms: "Check Available Rooms",
cloudbeds_opGetAvailableRoomsDesc: "Search for available rooms by date range",
cloudbeds_fieldCheckIn: "Check-in Date",
cloudbeds_fieldCheckOut: "Check-out Date",
cloudbeds_fieldDateHint: "Format: YYYY-MM-DD or {{variable}}",
cloudbeds_fieldAdults: "Number of Guests",
cloudbeds_fieldAdultsHint: "Number of adults or {{variable}}",
cloudbeds_varUnit: "Unit",
cloudbeds_varPrice: "Price",
cloudbeds_varCurrency: "Currency",
cloudbeds_errorGetAvailableRooms: "Could not check room availability. Please try again later.",
```

## Credential Storage

Credentials are stored in the `integrations` table:

```typescript
{
  id: string,
  user_id: string,
  integration_type: "cloudbeds" | "custom_api" | "your_new_service",
  config: {
    // Cloudbeds example:
    apiKey: string,
    propertyId: string  // auto-populated from test connection

    // Custom API example:
    name: string,
    baseUrl: string,
    authType: "bearer" | "api_key",
    authValue: string
  },
  status: "active" | "inactive"
}
```

## Backend Execution Flow

When a customer message hits an `api_call` node:

1. Fetch integration credentials from DB by `integrationId`
2. Build auth headers based on `integration_type`
3. Call `resolveOperation()` → substitutes `{{vars}}` in endpoint template
4. Prepend base URL (e.g., `https://api.cloudbeds.com` + resolved endpoint)
5. Execute fetch with 10s timeout + URL safety check
6. Extract response values via `extractJsonPath()` per response mapping
7. If extracted value is an object/array → LLM-format via `formatApiResponse()`
8. Route to **success** or **error** output handle

### Success/Error Routing

The API call node has two output handles:
- **Success** — taken when at least one response mapping returned data
- **Error** — taken when all mappings are empty, API returned error, or fetch failed

The `{{error}}` variable is set automatically on failure with a friendly message.

## Backend Auth Patterns

In `flow-demo/index.ts` and `flow-webhook/index.ts`, auth is built per `integration_type`:

```typescript
if (integration.integration_type === "cloudbeds") {
  baseUrl = "https://api.cloudbeds.com";
  headers["Authorization"] = `Bearer ${config.apiKey}`;
} else if (integration.integration_type === "your_service") {
  baseUrl = "https://api.yourservice.com";
  headers["Authorization"] = `Bearer ${config.apiToken}`;
} else {
  // Custom API fallback
  baseUrl = config.baseUrl || "";
  if (config.authType === "bearer") headers["Authorization"] = `Bearer ${config.authValue}`;
  else if (config.authType === "api_key") headers["x-api-key"] = config.authValue;
}
```

If your service uses standard Bearer auth with a fixed base URL, add a case like above.

## Checklist: Adding a New Service

- [ ] **Define the catalog entry** in `Client/src/types/integration-catalog.ts`
  - Service ID, label key
  - Operations with endpoint templates, input fields, response mappings
- [ ] **Copy catalog** to `supabase/functions/_shared/integration-catalog.ts` (keep identical)
- [ ] **Add i18n keys** in `Client/src/i18n/locales/en/flow.ts` (English)
- [ ] **Add i18n keys** in `Client/src/i18n/locales/he/flow.ts` (Hebrew)
- [ ] **Add auth pattern** in `flow-demo/index.ts` and `flow-webhook/index.ts` (if not standard Bearer/API key)
- [ ] **Add credential form** in `FlowIntegrationsModal.tsx` (if custom fields needed beyond the generic form)
- [ ] **Add test connection** logic in `supabase/functions/test-integration/index.ts` (if service-specific validation needed)
- [ ] **Update `integration_type`** enum in `database.ts` if using typed enums
- [ ] **Test**: add integration → configure node → run demo → verify variables populate
- [ ] **Deploy** all modified edge functions

## Tips

- **Input field placeholders** should suggest variable names from previous nodes (e.g., `{{checkin_date}}`) — this helps users wire up the flow
- **Response mappings** should extract individual scalar values (string, number) rather than whole objects — this gives users precise `{{variables}}` to use in message templates
- **Add a `currency` or `currencySymbol` mapping** if the API returns prices — don't hardcode `$` or `₪`
- **The `propertyId` pattern**: if the service has an account-level ID (like Cloudbeds propertyId), auto-populate it during test connection so users don't need to find it manually
- **Multiple operations**: a single service can have many operations (e.g., Cloudbeds could have `getAvailableRooms`, `createReservation`, `getGuest`, etc.)
