# Guia de estudos

## Como começar

Leia nesta ordem: `ARQUITETURA.md`, migration, Auth Service, Patient Service, Medical Record Service, repositório local da PWA, `SyncFacade`, Sync Service e por fim Document Service. Assim você acompanha um dado desde o login até o PDF.

## Fluxo 1 — login

1. O formulário chama `POST /auth/login`.
2. A API busca usuário/profissional, verifica Argon2id e registra tentativa.
3. A chave privada assina um access token RS256 curto.
4. O refresh token aleatório vai em cookie HttpOnly; o banco guarda apenas seu hash.
5. Os demais serviços leem a chave pública e validam `iss`, `aud`, `exp`, algoritmo, tipo e perfil.

Pergunta de apresentação: “por que assimétrico?” A chave privada permanece apenas no Auth Service; os outros serviços conseguem verificar sem poder emitir tokens.

## Fluxo 2 — paciente offline

`savePatient` abre transação Dexie e grava paciente + operação + evento. O UUID já nasce no cliente. O Portal ainda não vê nada. No upload, `SyncFacade` envia a operação; Sync Service deduplica e chama Patient Service. A criação e o evento do `change_feed` ficam numa transação PostgreSQL.

Pergunta: “e se a resposta se perder?” A outbox reenvia. O `operationId` e o UUID reconhecem a repetição sem uma segunda linha.

## Fluxo 3 — atendimento

O formulário reúne sinais vitais e uma avaliação Glasgow, Manchester ou START. A Factory valida a forma especializada. O repositório grava o atendimento e seus filhos dentro da mesma transação do serviço. Registros administrados guardam snapshot do nome/concentração do medicamento para preservar o histórico.

O sistema registra classificações informadas pelo profissional; não recomenda dose ou tratamento.

Fontes para estudar os campos: [Glasgow Coma Scale](https://www.glasgowcomascale.org/) e [START no CHEMM/HHS](https://chemm.hhs.gov/startadult.htm). Manchester é representado por apresentação, discriminador, prioridade/cor e tempo-alvo; a decisão continua humana.

## Fluxo 4 — conflito

Imagine paciente versão 3 no dispositivo. O Portal altera e gera versão 4. O cliente envia update com `baseVersion=3`: o `UPDATE ... WHERE version=3` não encontra linha e devolve 409. A Strategy registra cliente, servidor e decisão para revisão. “Último relógio vence” não é usado para dados clínicos.

## Fluxo 5 — PDF e e-mail

Document Service não consulta tabelas clínicas diretamente: chama APIs donas com o JWT recebido. PDFKit escreve em memória. Para e-mail, a regra usa `MailGateway`; `SmtpMailAdapter` traduz ao Nodemailer. Só há sucesso se o SMTP aceitar o destinatário, e o evento é auditado.

## Conceitos para explicar

- **Microsserviço:** processo implantável independente e dono de uma capacidade, não apenas pasta.
- **Offline-First:** o caminho normal salva localmente; rede é sincronização posterior.
- **Outbox:** fila persistente junto do dado local.
- **Controle otimista:** detecta mudança concorrente por versão sem travar usuários por longos períodos.
- **Idempotência:** repetir a mesma intenção produz o mesmo efeito.
- **Auditoria:** metadados de quem/quando/rota/status, sem copiar conteúdo clínico desnecessário.
- **Facade/Repository:** reduzem acoplamento entre interface, orquestração e persistência.

## Exercícios

1. Siga no código onde `professional_id` entra no JWT e chega ao log.
2. Explique por que o cursor só avança depois da transação Dexie.
3. Provoque `409` com `baseVersion` antigo e encontre `sync.conflicts`.
4. Repita um `operationId` e conte as linhas de destino.
5. Troque o Adapter SMTP por um fake no teste, sem alterar `DocumentService`.
6. Abra a PWA sem servidor e identifique quais funcionalidades permanecem locais.

## Limites conscientes

O projeto acadêmico usa um cluster PostgreSQL compartilhado por custo operacional, embora preserve schemas e código proprietário. IndexedDB não substitui segurança do dispositivo: em produção são necessárias criptografia de disco, MDM, bloqueio automático e política de retenção. A entrega final de e-mail depende do provedor e só pode ser comprovada na caixa do destinatário.
