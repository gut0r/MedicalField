# APIs

Todas as rotas de negócio, exceto `POST /auth/login`, exigem `Authorization: Bearer <JWT>`. Health checks e arquivos da documentação não executam negócio. Em produção, os processos escutam em `127.0.0.1` e só o Nginx é público.

## Documentação unificada

O Nginx publica uma interface Swagger única em `/documentation/`. O arquivo é gerado por `scripts/build-unified-openapi.py`, que coleta os seis contratos locais, ajusta as rotas para o prefixo público `/api` e agrupa os endpoints por serviço. O acesso à página continua protegido por autenticação HTTP.

## Contrato de autenticação

O access token é RS256 e contém `sub`, `professional_id`, `roles`, `iss`, `aud`, `iat`, `exp`, `jti` e `token_type=access`. Cada serviço valida algoritmo, assinatura, emissor, audiência, expiração e tipo. Rotas administrativas exigem `ADMIN`.

## 1. Auth Service — FastAPI :8001

| Método | Rota | Regra |
|---|---|---|
| POST | `/auth/login` | pública; autentica e emite access/refresh/offline grant |
| POST | `/auth/refresh` | cookie HttpOnly válido; rotaciona sessão |
| POST | `/auth/logout` | revoga a sessão atual |
| GET | `/auth/me` | profissional autenticado |
| GET | `/professionals` | lista profissionais |
| POST | `/users` | somente administrador |

Swagger: `/docs`; OpenAPI: `/openapi.json`.

## 2. Patient Service — Spring Boot :8081

| Método | Rota | Regra |
|---|---|---|
| GET | `/patients` | pesquisa/paginação; `includeInactive` |
| GET | `/patients/{id}` | detalhes |
| POST | `/patients` | cria; UUID do cliente é aceito e idempotente |
| PUT | `/patients/{id}` | exige `baseVersion` |
| DELETE | `/patients/{id}` | ADMIN; inativação lógica |

Swagger: `/swagger-ui/index.html`; OpenAPI: `/v3/api-docs`.

## 3. Medical Record Service — Express :3001

| Método | Rota | Regra |
|---|---|---|
| GET/POST | `/medical-records` | lista/cria prontuários |
| GET | `/medical-records/{id}` | detalhes |
| GET/POST | `/encounters` | histórico/registra atendimento completo |
| GET | `/encounters/{id}` | agrega sinais, triagens, medicamentos e procedimentos |
| POST | `/encounters/{id}/corrections` | correção auditável sem apagar original |

Swagger: `/docs`; OpenAPI: `/openapi.json`.

## 4. Medication Service — FastAPI :8002

| Método | Rota | Regra |
|---|---|---|
| GET | `/medications` | catálogo/pesquisa |
| GET | `/medications/{id}` | detalhes |
| POST/PUT/DELETE | `/medications...` | ADMIN; criar, versionar, inativar |
| GET | `/medication-changes` | feed específico do catálogo |

Swagger: `/docs`; OpenAPI: `/openapi.json`.

## 5. Sync Service — Spring Boot :8082

| Método | Rota | Regra |
|---|---|---|
| POST | `/sync/upload` | até 200 operações; resultado individual |
| GET | `/sync/download?cursor=` | lote ordenado do change feed |
| GET | `/audit/logs` | ADMIN; filtros e paginação |
| DELETE | `/audit/logs` | ADMIN; remove o histórico de logs HTTP |

O upload aceita `PATIENT`, `MEDICAL_RECORD`, `ENCOUNTER` e `OFFLINE_AUDIT`. Cada operação possui `operationId`, `entityId`, `entityType`, `action`, `baseVersion`, `occurredAt` e `payload`.

Swagger: `/swagger-ui/index.html`; OpenAPI: `/v3/api-docs`.

## 6. Document Service — Express :3002

| Método | Rota | Regra |
|---|---|---|
| GET | `/encounters/{id}/pdf` | PDF sob demanda, `application/pdf` |
| POST | `/encounters/{id}/email` | valida endereço e aguarda aceitação SMTP |

Swagger: `/docs`; OpenAPI: `/openapi.json`.

## Erros

- `400`: requisição sintaticamente inválida;
- `401`: token ausente, inválido ou expirado;
- `403`: perfil insuficiente;
- `404`: entidade inexistente;
- `409`: versão, idempotência ou unicidade em conflito;
- `422`: validação de domínio/campos;
- `502`: dependência HTTP ou SMTP falhou.

A coleção [MedicalField.postman_collection.json](../postman/MedicalField.postman_collection.json) cobre sucesso, autenticação ausente e erros representativos.
