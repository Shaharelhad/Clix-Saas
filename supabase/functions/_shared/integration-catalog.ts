// SYNC: Keep in sync with Client/src/types/integration-catalog.ts

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
  method: "GET" | "POST" | "PUT" | "PATCH";
  endpointTemplate: string;
  bodyTemplate?: string;
  constructUrl?: boolean;
  editableBody?: boolean;
  editableResponseMapping?: boolean;
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
          "/api/v1.2/getAvailableRoomTypes?propertyID={{propertyId}}&startDate={{startDate}}&endDate={{endDate}}&adults={{adults}}",
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
          {
            id: "adults",
            labelKey: "cloudbeds_fieldAdults",
            hintKey: "cloudbeds_fieldAdultsHint",
            required: true,
            type: "text",
            placeholder: "{{number_of_guests}}",
          },
        ],
        responseMapping: [
          {
            jsonPath: "data[0].propertyRooms[0].roomTypeName",
            variableName: "unit",
            labelKey: "cloudbeds_varUnit",
          },
          {
            jsonPath: "data[0].propertyRooms[0].roomRate",
            variableName: "price",
            labelKey: "cloudbeds_varPrice",
          },
          {
            jsonPath: "data[0].propertyCurrency.currencySymbol",
            variableName: "currency",
            labelKey: "cloudbeds_varCurrency",
          },
          {
            jsonPath: "data[0].propertyRooms[0].roomTypeID",
            variableName: "room_type_id",
            labelKey: "cloudbeds_varRoomTypeId",
          },
        ],
        errorMessageKey: "cloudbeds_errorGetAvailableRooms",
      },
      {
        id: "getBookingLink",
        labelKey: "cloudbeds_opGetBookingLink",
        descriptionKey: "cloudbeds_opGetBookingLinkDesc",
        method: "GET",
        constructUrl: true,
        endpointTemplate:
          "{{bookingUrl}}?checkin={{startDate}}&checkout={{endDate}}&adults={{adults}}&room={{roomTypeId}}",
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
          {
            id: "adults",
            labelKey: "cloudbeds_fieldAdults",
            hintKey: "cloudbeds_fieldAdultsHint",
            required: true,
            type: "text",
            placeholder: "{{number_of_guests}}",
          },
          {
            id: "roomTypeId",
            labelKey: "cloudbeds_fieldRoomTypeId",
            hintKey: "cloudbeds_fieldRoomTypeIdHint",
            required: true,
            type: "text",
            placeholder: "{{room_type_id}}",
          },
        ],
        responseMapping: [
          {
            jsonPath: "__constructedUrl",
            variableName: "booking_link",
            labelKey: "cloudbeds_varBookingLink",
          },
        ],
        errorMessageKey: "cloudbeds_errorGetBookingLink",
      },
    ],
  },
  {
    id: "notion",
    labelKey: "integrationNotion",
    operations: [
      {
        id: "queryDatabase",
        labelKey: "notion_opQueryDatabase",
        descriptionKey: "notion_opQueryDatabaseDesc",
        method: "POST",
        endpointTemplate: "/v1/databases/{{databaseId}}/query",
        bodyTemplate: `{"filter":{"property":"{{filterProperty}}","{{filterType}}":{"equals":"{{filterValue}}"}}}`,
        editableResponseMapping: true,
        inputFields: [
          {
            id: "databaseId",
            labelKey: "notion_fieldDatabaseId",
            hintKey: "notion_fieldDatabaseIdHint",
            required: true,
            type: "text",
            placeholder: "{{database_id}}",
          },
          {
            id: "filterProperty",
            labelKey: "notion_fieldFilterProperty",
            required: true,
            type: "text",
            placeholder: "מספר טלפון",
          },
          {
            id: "filterType",
            labelKey: "notion_fieldFilterType",
            required: true,
            type: "text",
            placeholder: "phone_number",
          },
          {
            id: "filterValue",
            labelKey: "notion_fieldFilterValue",
            required: true,
            type: "text",
            placeholder: "{{phone}}",
          },
        ],
        responseMapping: [],
        errorMessageKey: "notion_errorQueryDatabase",
      },
      {
        id: "getPage",
        labelKey: "notion_opGetPage",
        descriptionKey: "notion_opGetPageDesc",
        method: "GET",
        endpointTemplate: "/v1/pages/{{pageId}}",
        editableResponseMapping: true,
        inputFields: [
          {
            id: "pageId",
            labelKey: "notion_fieldPageId",
            required: true,
            type: "text",
            placeholder: "{{notion_page_id}}",
          },
        ],
        responseMapping: [],
        errorMessageKey: "notion_errorGetPage",
      },
      {
        id: "updatePage",
        labelKey: "notion_opUpdatePage",
        descriptionKey: "notion_opUpdatePageDesc",
        method: "PATCH",
        endpointTemplate: "/v1/pages/{{pageId}}",
        bodyTemplate: `{"properties":{}}`,
        editableBody: true,
        inputFields: [
          {
            id: "pageId",
            labelKey: "notion_fieldPageId",
            required: true,
            type: "text",
            placeholder: "{{notion_page_id}}",
          },
        ],
        responseMapping: [
          {
            jsonPath: "id",
            variableName: "updated_page_id",
            labelKey: "notion_varUpdatedPageId",
          },
        ],
        errorMessageKey: "notion_errorUpdatePage",
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
  constructUrl?: boolean;
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
    constructUrl: op.constructUrl,
  };
}
