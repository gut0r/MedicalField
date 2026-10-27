# MedicalField

Prontuário médico de emergência Offline-First desenvolvido para a disciplina de Arquiteturas de Software da Univates (2026/B).

O repositório contém um Portal Administrativo, um Cliente PWA instalável, PostgreSQL central e exatamente seis microsserviços em Python, Java e JavaScript. O atendimento é gravado primeiro no computador do socorrista e depois sincronizado com idempotência, controle de versão e conflitos rastreáveis.

## Componentes

| Componente | Tecnologia | Porta local |
|---|---|---:|
| Autenticação | Python 3.13, FastAPI | 8001 |
| Pacientes | Java 21, Spring Boot | 8081 |
| Prontuários e atendimentos | Node.js 22+, Express | 3001 |
| Medicamentos | Python 3.13, FastAPI | 8002 |
| Sincronização | Java 21, Spring Boot | 8082 |
| Documentos | Node.js 22+, Express, PDFKit, Nodemailer | 3002 |
| Portal administrativo | React, TypeScript, Vite | 5173 |
| Cliente de campo | React, TypeScript, Vite, Dexie/PWA | 5174 |
| Aplicativo do socorrista | Electron; empacota o cliente e mantém o IndexedDB local | 47831 (somente loopback) |

## Requisitos

- Node.js 22 LTS ou 24 LTS;
- Python 3.13+;
- Java 21 LTS e Maven 3.9+;
- PostgreSQL 16+;
- Nginx e systemd na implantação Ubuntu.

## Preparação local

1. Copie `.env.example` para `.env` e troque todos os valores `change-me`.
2. Crie o banco e aplique `database/migrations/001_initial.sql`.
3. Aplique `database/seeds/001_reference_data.sql`.
4. Em `backend/auth-service`, crie a venv, instale o projeto e execute `scripts/generate_dev_keys.py`.
5. Execute `scripts/create_demo_user.py`; a senha é lida interativamente e armazenada como Argon2id.
6. Instale as dependências de cada projeto Node/Python e compile os dois projetos Java.

Os comandos reproduzíveis estão em `scripts/`. Para iniciar todo o ambiente de desenvolvimento no Windows, use `scripts/run-local.ps1` depois de configurar o banco.

## Testes e build

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-all.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1
```

Os testes oficiais estão em [docs/ROTEIRO_TESTES.md](docs/ROTEIRO_TESTES.md). A implantação sem Docker está em [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md).

## Ambiente implantado

O Portal está publicado provisoriamente em `http://177.44.248.61/` e o cliente de campo em `http://177.44.248.61/field/`. Esse acesso por IP serve para homologação do Portal e das APIs; a instalação confiável da PWA continua condicionada a domínio e HTTPS. Os seis serviços executam somente em loopback, sob systemd, com Nginx como único ponto de entrada.

### Aplicativo local do socorrista

O cliente também pode ser empacotado como aplicativo Windows pela pasta `desktop/field-client`. O aplicativo inclui os arquivos do frontend, abre em uma janela própria, mantém o IndexedDB no computador e encaminha somente as chamadas `/api` para a VM. O botão **Abrir Cliente do Socorrista** usa o protocolo `medicalfield://` registrado pelo executável, portanto não depende de túnel ou terminal aberto.

O acesso web em `/field/` e o antigo túnel SSH continuam disponíveis apenas como contingência.

A documentação OpenAPI unificada fica em `http://177.44.248.61/documentation/`, protegida pela credencial HTTP de documentação.

### Configuração segura do SMTP

Na VM, execute o configurador interativo para cadastrar as credenciais SMTP do Brevo sem gravar a chave no histórico do shell:

```bash
sudo /opt/medicalfield/app/deployment/configure-smtp.sh
```

Informe o login SMTP exibido pelo Brevo, o remetente já verificado e uma chave SMTP válida. A chave é lida sem aparecer na tela. O configurador atualiza atomicamente o arquivo de ambiente e reinicia apenas o serviço de documentos.

## Segurança

- O login é a única rota pública de negócio.
- Access tokens RS256 duram pouco; o refresh token fica em cookie `HttpOnly` e é armazenado no servidor apenas como hash.
- Senhas usam Argon2id.
- JWTs validam assinatura, expiração, emissor, audiência, tipo e perfil.
- A sessão offline é cifrada com PBKDF2 + AES-GCM usando a mesma senha do profissional, que nunca é armazenada. O IndexedDB é isolado pela origem; em equipamentos reais deve ser combinado com usuário individual, bloqueio de tela e criptografia de disco.
- `.env`, chaves, credenciais SMTP e credenciais SSH nunca são versionadas.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [Banco de dados](docs/BANCO_DE_DADOS.md)
- [Design Patterns](docs/DESIGN_PATTERNS.md)
- [APIs](docs/APIS.md)
- [Sincronização](docs/SINCRONIZACAO.md)
- [Roteiro de testes](docs/ROTEIRO_TESTES.md)
- [Implantação](docs/IMPLANTACAO.md)
- [Guia de estudos](docs/GUIA_DE_ESTUDOS.md)

## Limites que exigem configuração externa

O envio de e-mail só pode ser validado de ponta a ponta após informar um provedor SMTP real. HTTPS confiável e instalação PWA fora de `localhost` dependem de um domínio/certificado válido. O código não simula sucesso nesses casos: erros SMTP e de rede são devolvidos ao usuário e auditados.
