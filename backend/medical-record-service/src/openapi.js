export const openApi = {
  openapi: '3.1.0',
  info: {
    title: 'MedicalField - Prontuarios e Atendimentos API',
    version: '0.1.0',
    description: 'Prontuarios, atendimentos, sinais vitais, triagens, medicamentos, procedimentos e correcoes auditaveis.',
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  security: [{ bearerAuth: [] }],
  tags: [{ name: 'Prontuarios' }, { name: 'Atendimentos' }],
  paths: {
    '/medical-records': {
      get: {
        tags: ['Prontuarios'], summary: 'Lista prontuarios',
        parameters: [{ name: 'patientId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MedicalRecord' } } } } }, 401: { $ref: '#/components/responses/Unauthorized' } },
      },
      post: {
        tags: ['Prontuarios'], summary: 'Cria prontuario',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MedicalRecordInput' }, example: { id: '4018ec77-87cd-49b2-9d41-a2bfa6e88d37', patientId: '21bd9253-382f-4e4b-9bcc-614253168b08' } } } },
        responses: { 201: { description: 'Criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/MedicalRecord' } } } }, 401: { $ref: '#/components/responses/Unauthorized' }, 422: { $ref: '#/components/responses/ValidationError' } },
      },
    },
    '/medical-records/{id}': {
      get: {
        tags: ['Prontuarios'], summary: 'Consulta um prontuario',
        parameters: [{ $ref: '#/components/parameters/UuidPath' }],
        responses: { 200: { description: 'Prontuario', content: { 'application/json': { schema: { $ref: '#/components/schemas/MedicalRecord' } } } }, 404: { description: 'Nao encontrado' } },
      },
    },
    '/encounters': {
      get: {
        tags: ['Atendimentos'], summary: 'Lista atendimentos e historico',
        parameters: [
          { name: 'patientId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'medicalRecordId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 200 } },
        ],
        responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Encounter' } } } } } },
      },
      post: {
        tags: ['Atendimentos'], summary: 'Registra atendimento completo',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EncounterInput' } } } },
        responses: { 201: { description: 'Atendimento criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Encounter' } } } }, 409: { description: 'Conflito de identificador ou versao' }, 422: { $ref: '#/components/responses/ValidationError' } },
      },
    },
    '/encounters/{id}': {
      get: {
        tags: ['Atendimentos'], summary: 'Consulta atendimento completo', parameters: [{ $ref: '#/components/parameters/UuidPath' }],
        responses: { 200: { description: 'Atendimento', content: { 'application/json': { schema: { $ref: '#/components/schemas/Encounter' } } } }, 404: { description: 'Nao encontrado' } },
      },
    },
    '/encounters/{id}/corrections': {
      post: {
        tags: ['Atendimentos'], summary: 'Registra correcao clinica sem apagar o historico', parameters: [{ $ref: '#/components/parameters/UuidPath' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['entityType', 'entityId', 'reason', 'previousValue', 'correctedValue'], properties: { entityType: { enum: ['ENCOUNTER', 'VITAL_SIGN', 'ASSESSMENT', 'MEDICATION', 'PROCEDURE'] }, entityId: { type: 'string', format: 'uuid' }, reason: { type: 'string' }, previousValue: { type: 'object' }, correctedValue: { type: 'object' } } } } } },
        responses: { 201: { description: 'Correcao auditavel criada' }, 422: { $ref: '#/components/responses/ValidationError' } },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    parameters: { UuidPath: { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } } },
    responses: {
      Unauthorized: { description: 'Token ausente, invalido ou expirado' },
      ValidationError: { description: 'Corpo invalido', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
    schemas: {
      Error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, issues: { type: 'array', items: { type: 'object' } } } },
      MedicalRecordInput: { type: 'object', required: ['patientId'], properties: { id: { type: 'string', format: 'uuid' }, patientId: { type: 'string', format: 'uuid' } } },
      MedicalRecord: { allOf: [{ $ref: '#/components/schemas/MedicalRecordInput' }, { type: 'object', properties: { version: { type: 'integer' }, active: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } } }] },
      VitalSign: { type: 'object', required: ['measuredAt'], properties: { id: { type: 'string', format: 'uuid' }, measuredAt: { type: 'string', format: 'date-time' }, systolicPressure: { type: ['integer', 'null'] }, diastolicPressure: { type: ['integer', 'null'] }, heartRate: { type: ['integer', 'null'] }, respiratoryRate: { type: ['integer', 'null'] }, oxygenSaturation: { type: ['number', 'null'] }, temperatureCelsius: { type: ['number', 'null'] }, consciousnessLevel: { type: 'string' } } },
      MedicationAdministration: { type: 'object', required: ['medicationId', 'medicationName', 'dose', 'doseUnit', 'administeredAt'], properties: { medicationId: { type: 'string', format: 'uuid' }, medicationName: { type: 'string' }, concentration: { type: 'string' }, dose: { type: 'number', exclusiveMinimum: 0 }, doseUnit: { type: 'string' }, route: { type: 'string' }, administeredAt: { type: 'string', format: 'date-time' }, notes: { type: 'string' } } },
      Procedure: { type: 'object', required: ['description', 'performedAt'], properties: { code: { type: 'string' }, description: { type: 'string' }, performedAt: { type: 'string', format: 'date-time' }, notes: { type: 'string' } } },
      EncounterInput: { type: 'object', required: ['medicalRecordId', 'patientId', 'occurredAt', 'occurrenceType', 'description'], properties: { id: { type: 'string', format: 'uuid' }, medicalRecordId: { type: 'string', format: 'uuid' }, patientId: { type: 'string', format: 'uuid' }, occurredAt: { type: 'string', format: 'date-time' }, occurrenceType: { type: 'string' }, description: { type: 'string' }, generalObservations: { type: 'string' }, vitalSigns: { type: 'array', items: { $ref: '#/components/schemas/VitalSign' } }, assessments: { type: 'array', description: 'GLASGOW, MANCHESTER ou START', items: { type: 'object' } }, medications: { type: 'array', items: { $ref: '#/components/schemas/MedicationAdministration' } }, procedures: { type: 'array', items: { $ref: '#/components/schemas/Procedure' } } } },
      Encounter: { allOf: [{ $ref: '#/components/schemas/EncounterInput' }, { type: 'object', properties: { version: { type: 'integer' }, status: { type: 'string' }, responsibleProfessionalId: { type: 'string', format: 'uuid' } } }] },
    },
  },
};
