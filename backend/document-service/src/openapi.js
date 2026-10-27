export const openApi = {
  openapi: '3.1.0',
  info: {
    title: 'MedicalField - Documentos API',
    version: '0.1.0',
    description: 'Gera fichas reais em PDF e envia anexos por SMTP. Nenhum documento clinico e persistido em disco.',
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/encounters/{id}/pdf': {
      get: {
        summary: 'Gera a ficha do atendimento em PDF',
        parameters: [{ $ref: '#/components/parameters/EncounterId' }],
        responses: {
          200: {
            description: 'PDF gerado sob demanda',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Token ausente ou invalido' },
          403: { description: 'Perfil sem permissao' },
          404: { description: 'Atendimento nao encontrado' },
          502: { description: 'Falha de integracao' },
        },
      },
    },
    '/encounters/{id}/email': {
      post: {
        summary: 'Envia a ficha PDF por SMTP',
        parameters: [{ $ref: '#/components/parameters/EncounterId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['recipient'],
                properties: {
                  recipient: { type: 'string', format: 'email', maxLength: 254 },
                },
              },
              example: { recipient: 'destinatario@example.com' },
            },
          },
        },
        responses: {
          200: {
            description: 'SMTP aceitou a mensagem',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    accepted: { type: 'boolean' },
                    messageId: { type: 'string' },
                    providerResponse: { type: 'string' },
                  },
                },
              },
            },
          },
          401: { description: 'Token ausente ou invalido' },
          403: { description: 'Perfil sem permissao' },
          422: { description: 'Destinatario invalido' },
          502: { description: 'SMTP ou servico dependente recusou a operacao' },
        },
      },
    },
    '/medical-records/{id}/pdf': {
      get: {
        summary: 'Gera o prontuário consolidado em PDF',
        parameters: [{ $ref: '#/components/parameters/MedicalRecordId' }],
        responses: {
          200: {
            description: 'PDF consolidado gerado sob demanda',
            content: {
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          401: { description: 'Token ausente ou invalido' },
          403: { description: 'Perfil sem permissao' },
          404: { description: 'Prontuario ou paciente nao encontrado' },
          502: { description: 'Falha de integracao' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    parameters: {
      EncounterId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'UUID do atendimento',
        schema: { type: 'string', format: 'uuid' },
      },
      MedicalRecordId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'UUID do prontuario',
        schema: { type: 'string', format: 'uuid' },
      },
    },
  },
};
