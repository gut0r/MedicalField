# Arquitetura do MedicalField

## Visão geral

O sistema separa o ambiente central da execução local do socorrista. A VM hospeda Portal, APIs e PostgreSQL. A PWA é baixada uma vez, instalada no computador e passa a usar Service Worker e IndexedDB; sua gravação clínica não depende da VM.

```mermaid
flowchart LR
  subgraph Dispositivo[Computador do socorrista]
    PWA[Cliente PWA]
    SW[Service Worker]
    IDB[(IndexedDB)]
    PWA --> SW
    PWA --> IDB
  end
  subgraph VM[VM Ubuntu]
    NG[Nginx + HTTPS]
    PORTAL[Portal React]
    AUTH[1 Auth · Python]
    PAT[2 Pacientes · Java]
    CARE[3 Prontuários · Node]
    MED[4 Medicamentos · Python]
    SYNC[5 Sincronização · Java]
    DOC[6 Documentos · Node]
    DB[(PostgreSQL)]
    NG --> PORTAL
    NG --> AUTH & PAT & CARE & MED & SYNC & DOC
    AUTH --> DB
    PAT --> DB
    CARE --> DB
    MED --> DB
    SYNC --> DB
    DOC --> DB
    DOC --> PAT & CARE
  end
  PWA <-->|REST + JWT| NG
  BROWSER[Browser administrativo] -->|HTTPS| NG
  DOC -->|SMTP| MAIL[Servidor de e-mail]
```

## Responsabilidades

1. **Auth Service** — identidade, Argon2id, emissão/renovação/revogação de JWT e profissionais.
2. **Patient Service** — dono do cadastro de pacientes, pesquisa, versão otimista e inativação.
3. **Medical Record Service** — dono de prontuários, atendimentos e dados clínicos anexos.
4. **Medication Service** — dono do catálogo de medicamentos; não recomenda tratamento ou dose.
5. **Sync Service** — coordena upload/download, deduplicação, conflitos e auditoria offline. Ele usa APIs donas para gravar entidades.
6. **Document Service** — consulta dados pelos serviços, monta PDF em memória e adapta o envio ao SMTP.

O compartilhamento do mesmo cluster PostgreSQL reduz o custo acadêmico, mas cada serviço acessa somente seus schemas de propriedade pelo código. Comunicação de negócio entre limites usa HTTP.

## Fluxos importantes

### Atendimento online

```mermaid
sequenceDiagram
  actor S as Socorrista
  participant P as PWA
  participant I as IndexedDB
  participant Y as Sync API
  participant C as Care API
  S->>P: Salvar atendimento
  P->>I: Entidade + outbox (transação)
  P->>Y: Upload com operationId
  Y->>C: POST /encounters
  C-->>Y: Entidade persistida
  Y-->>P: CONFIRMED
  P->>I: Remove somente a operação confirmada
```

### Atendimento offline

A mesma primeira transação local ocorre, mas nenhuma chamada remota é feita. Ao voltar para Online, o usuário aciona o Centro de Sincronização. Pacientes são enviados antes de prontuários e estes antes de atendimentos.

### Documento

O Portal chama o Document Service com JWT. O serviço busca atendimento e paciente em suas APIs donas, gera o PDF com PDFKit sem salvar cópia clínica em disco e retorna o buffer ou o entrega ao Adapter SMTP.

## Decisões arquiteturais

- UUID no cliente evita depender de sequências centrais.
- Outbox local e `processed_operations` central implementam entrega “pelo menos uma vez” sem duplicar efeitos.
- O `change_feed` fornece cursor monotônico; relógios de dispositivos não decidem conflitos.
- Registros clínicos são append-only na sincronização; correções usam evento auditável.
- Exclusões são lógicas quando cabíveis.
- Nginx é a única entrada pública; serviços escutam apenas em loopback.
