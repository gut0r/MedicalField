# Patterns do projeto MedicalField

Este documento mostra quais patterns existem no projeto, em quais arquivos eles estão e qual responsabilidade exercem no sistema.

## 1. Repository

### Arquivos

- `backend/patient-service/src/main/java/br/edu/univates/medicalfield/patient/repository/PatientRepository.java`
- `backend/patient-service/src/main/java/br/edu/univates/medicalfield/patient/service/PatientService.java`
- `backend/medical-record-service/src/repositories/medicalRecordRepository.js`
- `backend/medical-record-service/src/repositories/encounterRepository.js`
- `frontend/field-client/src/repositories/localRepository.ts`

### O que faz

Separa o acesso ao banco das regras de negócio. Os repositories executam consultas, inserções e atualizações no PostgreSQL ou no IndexedDB. Dessa forma, os services e as telas não precisam conhecer SQL nem detalhes da persistência.

No cliente offline, o `localRepository.ts` também grava a entidade e sua operação de sincronização na outbox local.

## 2. Strategy

### Arquivos

- `backend/sync-service/src/main/java/br/edu/univates/medicalfield/sync/strategy/ConflictStrategy.java`
- `backend/sync-service/src/main/java/br/edu/univates/medicalfield/sync/strategy/PatientConflictStrategy.java`
- `backend/sync-service/src/main/java/br/edu/univates/medicalfield/sync/strategy/AppendOnlyConflictStrategy.java`
- `backend/sync-service/src/main/java/br/edu/univates/medicalfield/sync/service/SyncService.java`

### O que faz

Define diferentes formas de tratar conflitos de sincronização.

- `PatientConflictStrategy` trata conflitos de pacientes e envia os campos para revisão manual.
- `AppendOnlyConflictStrategy` trata prontuários e atendimentos, impedindo que registros clínicos sejam sobrescritos silenciosamente.
- `SyncService` procura a Strategy compatível com o tipo da operação e executa sua decisão.

Isso evita concentrar todas as regras de conflito em uma grande sequência de condicionais.

## 3. Observer

### Arquivos

- `frontend/field-client/src/connectivity.ts`
- `frontend/field-client/src/components/ConnectivityToggle.tsx`
- `frontend/field-client/src/pages/SyncPage.tsx`
- `frontend/field-client/src/pages/LoginPage.tsx`
- `frontend/field-client/src/api.ts`

### O que faz

Mantém e publica o estado de conectividade do cliente. O `ConnectivitySubject` observa os eventos reais `online` e `offline` do navegador e também o seletor de simulação.

Os componentes se inscrevem nesse estado por meio de `useSyncExternalStore`. Quando a conectividade muda, todos os componentes inscritos são atualizados automaticamente.

O cliente considera que está online somente quando existe conexão física e o modo simulado também está online.

## 4. Factory

### Arquivos

- `backend/medical-record-service/src/domain/triageFactory.js`
- `backend/medical-record-service/src/repositories/encounterRepository.js`
- `backend/medical-record-service/test/triageFactory.test.js`

### O que faz

A função `createTriageAssessment` recebe os dados da triagem e escolhe qual estrutura deve ser criada e validada:

- Glasgow;
- Manchester;
- START.

Cada protocolo possui campos e validações diferentes. No Glasgow, a Factory calcula a pontuação total somente quando as três respostas foram testadas. Caso algum componente não seja testável, ela preserva o motivo e não inventa uma pontuação.

Tecnicamente, a implementação é uma função de fábrica, também chamada de Simple Factory.

## 5. Facade

### Arquivos

- `frontend/field-client/src/sync/SyncFacade.ts`
- `frontend/field-client/src/pages/SyncPage.tsx`
- `frontend/field-client/src/sync/SyncFacade.test.ts`

### O que faz

A `SyncFacade` oferece métodos simples para a interface:

- `upload()` envia as pendências;
- `download()` baixa alterações do servidor;
- `syncAll()` executa o envio e o download em sequência.

Internamente, ela controla outbox, ordem das entidades, lotes, chamadas HTTP, cursores, transações do IndexedDB, conflitos e histórico de sincronização. A tela não precisa conhecer esses detalhes.

## 6. Adapter

### Arquivos

- `backend/document-service/src/mail/mailGateway.js`
- `backend/document-service/src/mail/smtpMailAdapter.js`
- `backend/document-service/src/documentService.js`
- `backend/document-service/src/app.js`
- `backend/document-service/test/smtpMailAdapter.test.js`

### O que faz

Adapta o contrato interno de envio de documentos para o formato do Nodemailer e do servidor SMTP.

O `MailGateway` define o método que o sistema espera. O `SmtpMailAdapter` recebe destinatário, assunto, texto e PDF e converte essas informações para uma chamada `sendMail` do Nodemailer.

O `DocumentService` depende do `MailGateway`, e não diretamente do Brevo ou do Nodemailer. Por isso, o provedor pode ser trocado ou substituído por uma implementação falsa durante os testes sem alterar a regra de negócio.

## Resumo rápido

| Pattern | Responsabilidade no projeto |
|---|---|
| Repository | Isola PostgreSQL e IndexedDB das regras de negócio. |
| Strategy | Escolhe a política adequada para cada conflito de sincronização. |
| Observer | Notifica a interface quando o estado Online/Offline muda. |
| Factory | Cria e valida a avaliação Glasgow, Manchester ou START. |
| Facade | Esconde a complexidade do processo de sincronização. |
| Adapter | Traduz o envio interno de PDF para Nodemailer e SMTP. |
