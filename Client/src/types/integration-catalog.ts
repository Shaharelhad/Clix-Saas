// SYNC: Keep in sync with supabase/functions/_shared/integration-catalog.ts

// ── Types ──

export interface OperationInputField {
  id: string;
  labelKey: string;
  hintKey?: string;
  required: boolean;
  type: "text" | "number" | "date";
  placeholder?: string;
}

export interface OperationDefinition {
  id: string;
  labelKey: string;
  descriptionKey: string;
  method: "GET" | "POST" | "PUT";
  endpointTemplate: string;
  bodyTemplate?: string;
  inputFields: OperationInputField[];
  responseMapping: Array<{ jsonPath: string; variableName: string; labelKey: string }>;
  errorMessageKey: string;
}

export interface ServiceDefinition {
  id: string;
  labelKey: string;
  operations: OperationDefinition[];
}

// ── Catalog ──

export const INTEGRATION_CATALOG: ServiceDefinition[] = [
  {
    id: "cloudbeds",
    labelKey: "integrationCloudbeds",
    operations: [
      {
        id: "getAvailableRoomTypes",
        labelKey: "cloudbeds_opGetAvailableRooms",
        descriptionKey: "cloudbeds_opGetAvailableRoomsDesc",
        method: "GET",
        endpointTemplate:
          "/api/v1.2/getAvailableRoomTypes?propertyID={{propertyId}}&startDate={{startDate}}&endDate={{endDate}}",
        inputFields: [
          {
            id: "startDate",
            labelKey: "cloudbeds_fieldCheckIn",
            hintKey: "cloudbeds_fieldDateHint",
            required: true,
            type: "text",
            placeholder: "{{checkin_date}}",
          },
          {
            id: "endDate",
            labelKey: "cloudbeds_fieldCheckOut",
            hintKey: "cloudbeds_fieldDateHint",
            required: true,
            type: "text",
            placeholder: "{{checkout_date}}",
          },
        ],
        responseMapping: [
          {
            jsonPath: "data",
            variableName: "available_rooms",
            labelKey: "cloudbeds_varAvailableRooms",
          },
        ],
        errorMessageKey: "cloudbeds_errorGetAvailableRooms",
      },
    ],
  },
];

// ── Helpers ──

export function findServiceById(serviceId: string): ServiceDefinition | undefined {
  return INTEGRATION_CATALOG.find((s) => s.id === serviceId);
}

export function findOperationById(
  serviceId: string,
  operationId: string,
): OperationDefinition | undefined {
  return findServiceById(serviceId)?.operations.find((op) => op.id === operationId);
}

export function resolveOperation(
  serviceId: string,
  operationId: string,
  inputValues: Record<string, string>,
): {
  method: string;
  endpoint: string;
  bodyTemplate?: string;
  responseMapping: Array<{ jsonPath: string; variableName: string }>;
  errorMessageKey: string;
} | null {
  const op = findOperationById(serviceId, operationId);
  if (!op) return null;

  let endpoint = op.endpointTemplate;
  let body = op.bodyTemplate;

  for (const [key, value] of Object.entries(inputValues)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    endpoint = endpoint.replace(pattern, value);
    if (body) body = body.replace(pattern, value);
  }

  return {
    method: op.method,
    endpoint,
    bodyTemplate: body,
    responseMapping: op.responseMapping.map((m) => ({
      jsonPath: m.jsonPath,
      variableName: m.variableName,
    })),
    errorMessageKey: op.errorMessageKey,
  };
}
