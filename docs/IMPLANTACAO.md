# Implantação na VM Ubuntu

Este projeto não usa Docker. Nginx termina HTTPS, entrega os frontends e encaminha `/api`; os seis processos escutam apenas em loopback e são supervisionados pelo systemd.

## 1. Auditoria antes de alterar

Execute apenas leitura:

```bash
lsb_release -a
nproc
free -h
df -h
systemctl --type=service --state=running
sudo ss -lntup
ip -brief address
sudo nginx -T 2>/dev/null || true
psql --version || true
node --version || true
python3 --version
java -version || true
```

Confirme espaço, portas e serviços existentes antes de instalar. Não substitua configurações desconhecidas.

## 2. Dependências

Pacotes esperados: Git, Nginx, PostgreSQL 16+, Python 3.13 com `venv`, Node 22/24 LTS, Java 21 e Maven 3.9+. Use repositórios oficiais adequados à versão efetiva do Ubuntu.

Crie o usuário de sistema sem login e diretórios:

```bash
sudo useradd --system --home /opt/medicalfield --shell /usr/sbin/nologin medicalfield
sudo install -d -o medicalfield -g medicalfield /opt/medicalfield/{app,env,secrets}
sudo install -d -o www-data -g www-data /var/www/medicalfield/{portal,field,api-docs}
```

## 3. PostgreSQL

Crie banco/usuário com senha forte gerada no servidor. Não copie o valor para Git:

```sql
CREATE ROLE medicalfield_app LOGIN PASSWORD '<senha-forte>';
CREATE DATABASE medicalfield OWNER medicalfield_app;
```

Depois, como o usuário da aplicação:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_initial.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seeds/001_reference_data.sql
```

Migrations e seeds falham imediatamente em erro; o seed é reexecutável.

## 4. Código e dependências

Copie/clone o commit aprovado para `/opt/medicalfield/app`. Em cada serviço Python, crie `.venv` e execute `pip install .`. Em projetos Node, use `npm ci --omit=dev`. Em Java, execute `mvn clean package` e mantenha o JAR em `target/`.

Compile os frontends com `VITE_API_BASE_URL=/api` e `VITE_FIELD_CLIENT_URL=/field/`; copie `dist/` para os diretórios de `/var/www`.

Com os seis serviços ativos, gere e instale o contrato OpenAPI unificado. A interface reutiliza os arquivos estáticos do `swagger-ui-dist` instalado pelo Document Service:

```bash
python3 scripts/build-unified-openapi.py --output /tmp/medicalfield-openapi.json
sudo install -m 644 -o www-data -g www-data deployment/api-docs/index.html deployment/api-docs/swagger-initializer.js /var/www/medicalfield/api-docs/
sudo install -m 644 -o www-data -g www-data backend/document-service/node_modules/swagger-ui-dist/{swagger-ui.css,swagger-ui-bundle.js,swagger-ui-standalone-preset.js} /var/www/medicalfield/api-docs/
sudo install -m 644 -o www-data -g www-data /tmp/medicalfield-openapi.json /var/www/medicalfield/api-docs/openapi.json
```

## 5. Segredos

Gere RSA 3072 no servidor:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out /opt/medicalfield/secrets/jwt-private.pem
openssl rsa -pubout -in /opt/medicalfield/secrets/jwt-private.pem -out /opt/medicalfield/secrets/jwt-public.pem
sudo chown medicalfield:medicalfield /opt/medicalfield/secrets/jwt-*.pem
sudo chmod 600 /opt/medicalfield/secrets/jwt-private.pem
sudo chmod 644 /opt/medicalfield/secrets/jwt-public.pem
```

Copie `deployment/env/medicalfield.env.example` para `/opt/medicalfield/env/medicalfield.env`, preencha PostgreSQL/SMTP e use `chmod 600`. Nunca inclua credencial SSH nesse arquivo.

Crie o administrador pelo script interativo do Auth Service; a senha não aparece no terminal e vira Argon2id.

## 6. systemd e Nginx

Copie as seis units de `deployment/systemd/` para `/etc/systemd/system/`. Elas limitam os dois heaps Java a 192 MiB e os processos Node a 128 MiB, decisão necessária para a VM acadêmica de baixa memória. Crie também a credencial separada da documentação:

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.medicalfield-docs.htpasswd medicalfield-docs
```

Depois:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now medicalfield-auth medicalfield-patients medicalfield-records
sudo systemctl enable --now medicalfield-medications medicalfield-sync medicalfield-documents
```

Verifique `systemctl status` e `journalctl -u <unit>` antes de expor o Nginx. Copie a configuração Nginx, substitua `medicalfield.example.com` pelo domínio real, valide com `sudo nginx -t` e só então recarregue.

## 7. HTTPS e PWA

Service Worker é permitido em `localhost` ou contexto HTTPS confiável. Um IP isolado não garante certificado público. Antes da apresentação, providencie domínio/DNS ou certificado institucional. Depois do HTTPS:

1. abrir `/field/` online;
2. instalar a PWA;
3. autenticar online para preparar o acesso offline;
4. confirmar o Service Worker “activated”;
5. desligar a rede e reabrir o aplicativo instalado.

## 8. Validação

```bash
curl -fsS http://127.0.0.1:8001/internal/health
curl -fsS http://127.0.0.1:8081/internal/health
curl -fsS http://127.0.0.1:3001/internal/health
curl -fsS http://127.0.0.1:8002/internal/health
curl -fsS http://127.0.0.1:8082/internal/health
curl -fsS http://127.0.0.1:3002/internal/health
```

Em seguida execute a coleção Postman e os 17 casos. O SMTP precisa ser testado com recebimento real; resposta `accepted` só prova aceitação inicial do servidor.

## 9. Atualização e rollback

Implante uma release em diretório versionado, compile, aplique migrations aditivas, troque o symlink `current`, reinicie e valide health checks. Se um processo falhar, reverta o symlink para a release anterior. Faça backup lógico antes de migration destrutiva; este projeto não inclui migrations destrutivas.

## Estado real da VM em 13/10/2026

- Ubuntu 26.04 LTS, 1 vCPU, 1,6 GiB de RAM, 2 GiB de swap e cerca de 30 GiB livres;
- PostgreSQL 18, Nginx 1.28, Node.js 22, Java 21 e Python 3.14 instalados;
- migration e seed aplicados no banco `medicalfield` com credencial gerada no servidor;
- chaves JWT RSA 3072 geradas em `/opt/medicalfield/secrets`, fora do repositório;
- seis units habilitadas e respondendo nos respectivos `/internal/health`;
- Portal publicado em `http://177.44.248.61/` e cliente de campo em `/field/`;
- Swagger unificado publicado em `http://177.44.248.61/documentation/`, com 22 caminhos agrupados por serviço e protegido pela credencial HTTP da documentação;
- a política de `sudo` da VM proíbe criar usuários. Por isso, apenas nessa VM, as units executam como `univates`; os templates permanecem com o usuário dedicado `medicalfield` recomendado para servidores sem essa restrição;
- o sistema reporta reinicialização pendente para ativar o kernel instalado. Planeje uma janela, reinicie e repita os seis health checks.

## Pendências externas

- domínio/DNS e certificado HTTPS;
- conta SMTP e política de remetente;
- regras institucionais de firewall/backup;
- capacidade real da VM, que deve ser inspecionada antes da instalação.
