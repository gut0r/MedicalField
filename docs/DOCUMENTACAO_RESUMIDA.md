# MEDICALFIELD

## Prontuário Médico de Emergência Offline-First

**Acadêmico:** [Preencher nome]  
**Disciplina:** Arquiteturas de Software  
**Instituição:** Universidade do Vale do Taquari – Univates  
**Professor:** [Preencher nome]  
**Ano:** 2026

---

# 1. Introdução

O MedicalField é um sistema para o registro de atendimentos médicos de emergência. Ele permite cadastrar pacientes, criar prontuários, registrar atendimentos, sinais vitais, triagens, medicamentos administrados e procedimentos realizados.

O principal diferencial é o funcionamento Offline-First. O socorrista pode continuar trabalhando sem internet, pois os dados são armazenados no próprio dispositivo. Quando a conexão retorna, as operações pendentes são enviadas ao servidor central.

O sistema possui duas interfaces: um Portal Administrativo para consultar e administrar os dados centrais e um Cliente do Socorrista para o trabalho de campo. O backend foi separado em seis microsserviços e utiliza PostgreSQL, IndexedDB, autenticação JWT, auditoria, geração de PDF e envio por e-mail.

# 2. Objetivos

O objetivo geral é disponibilizar uma arquitetura distribuída para registrar atendimentos de emergência mesmo em locais com conexão instável ou inexistente.

Os objetivos específicos são:

- cadastrar e consultar pacientes, prontuários, atendimentos e medicamentos;
- registrar informações clínicas e protocolos de triagem;
- permitir o uso online e offline;
- sincronizar os dados locais com o servidor;
- impedir duplicações e identificar conflitos de versão;
- proteger o acesso por autenticação e perfis;
- gerar o PDF do atendimento e enviá-lo por e-mail;
- manter logs de auditoria das operações.

# 3. Funcionalidades

O Portal Administrativo permite realizar login, consultar o dashboard, administrar pacientes e medicamentos, visualizar prontuários e atendimentos, consultar profissionais e logs, gerar PDFs, enviar documentos por e-mail e acessar a documentação das APIs.

O Cliente do Socorrista permite realizar login, baixar os dados necessários para o dispositivo, cadastrar pacientes, registrar atendimentos completos, trabalhar sem internet, consultar o histórico local e enviar as pendências quando a conexão estiver disponível.

# 4. Arquitetura

O projeto utiliza microsserviços junto com o modelo Offline-First. Na VM estão o Portal Administrativo, os seis serviços de backend, o banco PostgreSQL, o Nginx e a documentação Swagger. No dispositivo do socorrista, o Cliente PWA usa Service Worker e IndexedDB para continuar funcionando offline.

O Nginx é o ponto de entrada público. Ele entrega os frontends e encaminha as requisições iniciadas por `/api` ao microsserviço responsável.

**[INSERIR AQUI A IMAGEM DA ARQUITETURA]**

**Legenda sugerida:** Figura 1 – Arquitetura do sistema MedicalField. Fonte: elaborado pelo autor (2026).

## 4.1 Componentes principais

| Componente | Responsabilidade | Tecnologia |
|---|---|---|
| Auth Service | Login, tokens, sessões, usuários e profissionais | Python e FastAPI |
| Patient Service | Cadastro e controle de pacientes | Java e Spring Boot |
| Medical Record Service | Prontuários, atendimentos e dados clínicos | Node.js e Express |
| Medication Service | Catálogo de medicamentos | Python e FastAPI |
| Sync Service | Upload, download, idempotência e conflitos | Java e Spring Boot |
| Document Service | Geração de PDF e envio de e-mail | Node.js e Express |
| Portal Administrativo | Administração dos dados centrais | React e TypeScript |
| Cliente do Socorrista | Operação online e offline | React, TypeScript e PWA |
| Banco central | Persistência dos dados compartilhados | PostgreSQL |
| Banco local | Persistência no dispositivo | IndexedDB e Dexie |

# 5. Tecnologias utilizadas

No frontend foram utilizados React, TypeScript, Vite, React Router, Tailwind CSS, Lucide React, Dexie, IndexedDB e vite-plugin-pwa. No backend foram utilizados Python com FastAPI, Java com Spring Boot e Node.js com Express. A validação dos dados é realizada com Pydantic e Zod.

O sistema também utiliza PostgreSQL, JWT, Argon2id, PDFKit, Nodemailer, SMTP da Brevo, Nginx, systemd, OpenAPI, Swagger UI, Git e Ubuntu.

# 6. Banco de dados

O banco central é o PostgreSQL. As tabelas foram separadas em schemas de acordo com a responsabilidade de cada serviço:

- `identity`: profissionais, usuários, perfis e sessões;
- `patient`: pacientes;
- `care`: prontuários, atendimentos e informações clínicas;
- `medication`: catálogo de medicamentos;
- `sync`: dispositivos, lotes, operações processadas, alterações e conflitos;
- `audit`: logs HTTP, eventos offline e eventos de documentos.

As principais tabelas clínicas são `medical_records`, `encounters`, `vital_sign_measurements`, `glasgow_assessments`, `manchester_assessments`, `start_assessments`, `administered_medications`, `performed_procedures` e `clinical_corrections`.

Um paciente pode possuir um prontuário, e um prontuário pode possuir vários atendimentos. Cada atendimento pode conter sinais vitais, avaliações, medicamentos e procedimentos. Algumas ligações entre schemas são feitas por UUID, evitando o acoplamento direto entre microsserviços.

Pacientes, prontuários, atendimentos e medicamentos possuem controle de versão. Quando duas alterações usam versões diferentes, a API informa um conflito em vez de sobrescrever os dados. Pacientes e medicamentos usam exclusão lógica: ao serem inativados, permanecem no banco para preservar o histórico, mas deixam de aparecer nas listagens comuns.

**[INSERIR AQUI A IMAGEM DO MODELO ENTIDADE-RELACIONAMENTO]**

**Legenda sugerida:** Figura 2 – Modelo entidade-relacionamento do banco MedicalField. Fonte: elaborado pelo autor (2026).

# 7. APIs

As APIs usam o prefixo `/api`. Com exceção do login e da renovação da sessão, as rotas protegidas exigem um access token JWT.

## 7.1 Autenticação e profissionais

- `POST /api/auth/login`: autentica e gera os tokens;
- `POST /api/auth/refresh`: renova o access token;
- `POST /api/auth/logout`: encerra a sessão;
- `GET /api/auth/me`: retorna o usuário autenticado;
- `GET /api/professionals`: lista profissionais;
- `POST /api/users`: cria um usuário.

## 7.2 Pacientes

- `GET /api/patients`: pesquisa pacientes;
- `GET /api/patients/{id}`: consulta um paciente;
- `POST /api/patients`: cadastra um paciente;
- `PUT /api/patients/{id}`: atualiza um paciente;
- `DELETE /api/patients/{id}`: inativa um paciente.

## 7.3 Prontuários e atendimentos

- `GET` e `POST /api/medical-records`: listam e criam prontuários;
- `GET /api/medical-records/{id}`: consulta um prontuário;
- `GET` e `POST /api/encounters`: listam e criam atendimentos;
- `GET /api/encounters/{id}`: consulta o atendimento completo;
- `POST /api/encounters/{id}/corrections`: registra uma correção auditável.

## 7.4 Medicamentos

- `GET` e `POST /api/medications`: pesquisam e cadastram medicamentos;
- `GET /api/medications/{id}`: consulta um medicamento;
- `PUT /api/medications/{id}`: atualiza um medicamento;
- `DELETE /api/medications/{id}`: inativa um medicamento;
- `GET /api/medication-changes`: consulta alterações do catálogo.

## 7.5 Sincronização, auditoria e documentos

- `POST /api/sync/upload`: envia as operações pendentes;
- `GET /api/sync/download`: baixa alterações posteriores ao cursor;
- `GET /api/audit/logs`: consulta os logs centralizados;
- `DELETE /api/audit/logs`: limpa os logs;
- `GET /api/documents/encounters/{id}/pdf`: gera o PDF;
- `POST /api/documents/encounters/{id}/email`: envia o PDF por e-mail.
- `GET /api/documents/medical-records/{id}/pdf`: gera o PDF consolidado do prontuário.

Os códigos mais comuns são `200` para sucesso, `201` para criação, `204` para sucesso sem conteúdo, `401` para falha de autenticação, `403` para falta de permissão, `404` para registro inexistente, `409` para conflito e `422` para dados inválidos.

# 8. Funcionamento Offline-First

O IndexedDB funciona como banco operacional do Cliente do Socorrista. Ao salvar um paciente ou atendimento, o cliente grava o dado local e uma operação em uma fila chamada outbox. As duas gravações ocorrem na mesma transação, evitando que um dado fique sem sua operação de sincronização.

No modo online, o cliente tenta enviar a operação logo após salvá-la. No modo offline, ela permanece pendente. Quando a conexão retorna, o Sync Service recebe um lote com as pendências. Pacientes são enviados antes dos prontuários, e os prontuários antes dos atendimentos.

Cada operação possui um `operationId`. O servidor registra os identificadores que já processou. Se a mesma operação for reenviada, o servidor responde que ela já foi processada e não duplica o registro. Esse mecanismo garante idempotência.

Para baixar alterações, o cliente utiliza um cursor. O servidor devolve apenas os eventos posteriores a esse valor. O cursor somente é atualizado depois que os dados forem gravados localmente com sucesso.

Nas edições, o cliente envia a versão que possuía. Se o servidor já tiver uma versão mais recente, o sistema registra um conflito para revisão. Dados clínicos usam uma estratégia conservadora para impedir substituições silenciosas.

# 9. Segurança e auditoria

As senhas são protegidas com Argon2id e não ficam armazenadas em texto puro. O access token é um JWT assinado com RS256 e possui curta duração. O refresh token é enviado em cookie `HttpOnly`, e o banco armazena somente seu hash.

O sistema possui os perfis ADMIN, MEDICO, ENFERMEIRO e SOCORRISTA. As permissões são verificadas antes das operações protegidas.

O acesso offline só é preparado depois de um login online válido. A senha não é salva no dispositivo. A sessão local é protegida com uma chave derivada por PBKDF2 e criptografia AES-GCM.

A auditoria registra serviço, rota, método, profissional, status e tempo de processamento. Senhas, tokens e corpos clínicos não são armazenados nos logs HTTP.

# 10. Design Patterns

## 10.1 Repository

Separa as regras de negócio do acesso ao banco. Está presente em `PatientRepository.java`, `medicalRecordRepository.js`, `encounterRepository.js` e `localRepository.ts`.

## 10.2 Strategy

Permite escolher a regra usada em cada tipo de conflito. `PatientConflictStrategy.java` trata pacientes, enquanto `AppendOnlyConflictStrategy.java` protege prontuários e atendimentos. A escolha ocorre em `SyncService.java`.

## 10.3 Observer

Notifica os componentes quando a conectividade muda. A implementação principal está em `frontend/field-client/src/connectivity.ts` e é usada por `ConnectivityToggle.tsx` e `SyncPage.tsx`.

## 10.4 Factory

A função em `triageFactory.js` recebe o tipo da triagem e cria a avaliação adequada para Glasgow, Manchester ou START. Ela é utilizada por `encounterRepository.js`.

## 10.5 Facade

A `SyncFacade.ts` oferece comandos simples para enviar e baixar dados, escondendo detalhes de outbox, lotes, cursores, chamadas HTTP e conflitos. Ela é utilizada por `SyncPage.tsx`.

## 10.6 Adapter

O `SmtpMailAdapter.js` adapta o contrato interno `MailGateway` ao Nodemailer e ao SMTP. Assim, o serviço de documentos não depende diretamente de um provedor específico.

# 11. PDF, e-mail e implantação

O Document Service consulta os dados do atendimento e usa PDFKit para gerar o documento em memória. O PDF pode ser baixado pelo navegador ou enviado como anexo. O envio utiliza Nodemailer e SMTP da Brevo, e seu resultado é registrado na auditoria.

O sistema está implantado em uma VM Ubuntu. Os seis microsserviços são mantidos pelo systemd e aceitam conexões apenas internamente. O Nginx é o componente exposto e atua como proxy reverso.

No ambiente de demonstração, o Portal Administrativo está disponível na raiz do servidor, o Cliente do Socorrista em `/field/` e o Swagger em `/documentation/`. Um túnel SSH pode encaminhar o sistema para `http://localhost:8080/field/`, permitindo apresentar a PWA em uma origem local confiável.

# 12. Testes

Foram executados 29 testes automatizados nos serviços e no Cliente do Socorrista. Também foram validados os builds dos serviços Java e dos dois frontends.

Pelo Swagger foram testados autenticação, pacientes, prontuários, atendimentos, correções clínicas, medicamentos, sincronização, idempotência, auditoria, geração de PDF e envio real por e-mail.

O fluxo offline também foi verificado: os dados criados sem conexão permaneceram somente no dispositivo e não apareceram no portal. Depois da conexão ser restabelecida e das pendências serem enviadas, os dados passaram a aparecer no banco central e no Portal Administrativo.

# 13. Limitações e melhorias futuras

Como melhorias futuras, podem ser adicionados domínio com HTTPS, backup automatizado, monitoramento, interface para revisão de conflitos, testes de carga, criptografia completa dos dispositivos e políticas institucionais de retenção dos dados.

# 14. Conclusão

O MedicalField demonstra uma arquitetura distribuída capaz de registrar atendimentos de emergência em locais com conectividade limitada. O uso de IndexedDB, outbox, idempotência, controle de versão e tratamento de conflitos permite trabalhar offline sem perder a consistência durante a sincronização.

A separação em microsserviços organiza as responsabilidades de autenticação, pacientes, prontuários, medicamentos, sincronização e documentos. Os testes confirmaram o funcionamento do fluxo completo, incluindo autenticação, trabalho offline, sincronização, auditoria, PDF e envio por e-mail.

# Referências técnicas do projeto

- `README.md`;
- `database/migrations/001_initial.sql`;
- `docs/ARQUITETURA.md`;
- `docs/BANCO_DE_DADOS.md`;
- `docs/APIS.md`;
- `docs/SINCRONIZACAO.md`;
- `docs/PATTERNS_DO_PROJETO.md`.
