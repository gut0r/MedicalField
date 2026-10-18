# Roteiro de testes

## Preparação

1. Serviços e PostgreSQL ativos; health checks locais respondendo.
2. Migração, seed e usuário administrador criados.
3. Portal e PWA acessíveis por HTTPS (ou `localhost` durante teste local).
4. PWA instalada e preparada por um login online.
5. SMTP real configurado e destinatário de teste disponível.
6. DevTools aberto apenas quando for necessário comprovar IndexedDB/Service Worker.

## Dezessete testes oficiais

1. **Portal: autenticar.** Entrar com o usuário criado interativamente; mostrar dashboard.
2. **Portal: listar cadastros.** Abrir Pacientes, Medicamentos e Profissionais.
3. **Portal: listar prontuários.** Abrir Prontuários e detalhes.
4. **Portal: listar atendimentos.** Abrir Atendimentos e um registro completo.
5. **Cliente: autenticar.** Abrir PWA e autenticar online; a mesma senha prepara o acesso offline deste dispositivo.
6. **Servidor → Cliente.** Em Centro de Sincronização, clicar “Baixar Dados”; conferir contagens e tela Dados.
7. **Cliente Online: atendimento.** Manter seletor Online, registrar atendimento e observar outbox confirmada.
8. **Portal: visualizar atendimento.** Atualizar Atendimentos e abrir o registro criado.
9. **Novo medicamento via banco.** Executar `psql ... -f database/demo/insert_demo_medication.sql`.
10. **Portal: listar atendimentos.** Confirmar que o estado clínico não foi afetado.
11. **Cliente: novo download.** Baixar dados e mostrar “Cetamina (demonstração)” no IndexedDB/tela Dados.
12. **Cliente Offline.** Selecionar Offline; criar pessoa, prontuário implícito e atendimento.
13. **Portal antes do upload.** Pesquisar; os IDs criados offline não podem aparecer.
14. **Cliente Online: enviar.** Voltar a Online e clicar “Enviar Pendências” ou “Sincronizar Tudo”.
15. **Portal depois do upload.** Atualizar pacientes, prontuários e atendimentos; os três devem aparecer.
16. **PDF.** No atendimento, clicar PDF; verificar `%PDF`, conteúdo real e download.
17. **E-mail.** Informar destinatário real; confirmar aceitação SMTP, recebimento e anexo.

## Testes adicionais obrigatórios

| Caso | Execução | Resultado esperado |
|---|---|---|
| Sem token | remover Bearer no Postman | `401`, log com profissional vazio |
| Token inválido | usar texto aleatório | `401` |
| Token expirado | aguardar/usar fixture expirada | `401`, nunca aceito offline pelo servidor |
| Perfil inadequado | usuário não ADMIN em DELETE medicamento | `403` |
| Logs | filtrar por API/status/rota | seis serviços presentes |
| Offline real | desligar rede e reabrir PWA | shell e dados locais disponíveis |
| Persistência | fechar/reabrir browser | entidades/outbox continuam |
| Idempotência | repetir mesmo `operationId` | `ALREADY_PROCESSED`, uma entidade |
| ID adulterado | mesmo `operationId`, outro payload | `409` |
| Falha parcial | lote com uma operação inválida | válidas confirmadas, inválida mantida |
| Conflito | editar mesma versão no Portal/Cliente | `409` e `sync.conflicts` |
| PDF | salvar resposta Postman | arquivo abre e contém dados reais |
| SMTP rejeitado | destinatário/provedor de teste rejeitado | resposta de erro, nunca sucesso falso |

## Evidências

Registre data, commit, ambiente, entradas não sensíveis, resultado, captura e IDs. Não grave senha, JWT completo ou dados pessoais reais. Para cada falha, registre causa e nova execução; não substitua execução por descrição.
