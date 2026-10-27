# MedicalField Socorrista para Windows

Aplicativo desktop opcional construído sobre o mesmo cliente React/PWA. Ele não substitui o cliente web: empacota os arquivos do frontend no computador, mantém o IndexedDB local e encaminha somente as chamadas `/api` para a VM configurada em `config.json`.

## Desenvolvimento

```powershell
npm install
npm test
npm start
```

## Gerar o aplicativo portátil

```powershell
npm run package:win
```

O executável é criado dentro de `release/MedicalField Socorrista-win32-x64/`. Ao ser aberto pela primeira vez, registra o protocolo `medicalfield://`, utilizado pelo botão do Portal Administrativo.

O menu **MedicalField → Inspecionar banco local** ou o atalho `Ctrl+Shift+I` abre as ferramentas do Chromium. As tabelas ficam em **Application → IndexedDB**.
