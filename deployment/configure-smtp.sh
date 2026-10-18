#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/medicalfield/env/medicalfield.env"
SERVICE="medicalfield-documents.service"

if [[ ${EUID} -ne 0 ]]; then
  exec sudo "$0" "$@"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo de ambiente não encontrado: $ENV_FILE" >&2
  exit 1
fi

read -r -p "Login SMTP mostrado pelo Brevo: " smtp_user
read -r -p "E-mail remetente verificado no Brevo: " sender_email
read -r -s -p "Nova chave SMTP do Brevo (não será exibida): " smtp_password
printf '\n'

if [[ -z "$smtp_user" || -z "$sender_email" || -z "$smtp_password" ]]; then
  echo "Login, remetente e chave SMTP são obrigatórios." >&2
  exit 1
fi

if [[ "$smtp_user" == *[[:space:]]* || "$sender_email" == *[[:space:]]* ]]; then
  echo "Login e e-mail não podem conter espaços." >&2
  exit 1
fi

if [[ "$sender_email" != *@*.* ]]; then
  echo "Informe um endereço de remetente válido." >&2
  exit 1
fi

umask 077
original_file=$(mktemp "${ENV_FILE}.original.XXXXXX")
new_file=$(mktemp "${ENV_FILE}.new.XXXXXX")

cleanup() {
  rm -f "$original_file" "$new_file"
}
trap cleanup EXIT

cp -p "$ENV_FILE" "$original_file"
grep -Ev '^SMTP_(HOST|PORT|SECURE|USER|PASSWORD|FROM)=' "$ENV_FILE" > "$new_file" || true

{
  printf '%s\n' 'SMTP_HOST=smtp-relay.brevo.com'
  printf '%s\n' 'SMTP_PORT=587'
  printf '%s\n' 'SMTP_SECURE=false'
  printf 'SMTP_USER=%s\n' "$smtp_user"
  printf 'SMTP_PASSWORD=%s\n' "$smtp_password"
  printf 'SMTP_FROM="MedicalField <%s>"\n' "$sender_email"
} >> "$new_file"

chown --reference="$ENV_FILE" "$new_file"
chmod --reference="$ENV_FILE" "$new_file"
mv "$new_file" "$ENV_FILE"

if ! systemctl restart "$SERVICE" || ! systemctl is-active --quiet "$SERVICE"; then
  echo "O serviço não iniciou; restaurando a configuração anterior." >&2
  cp -p "$original_file" "$ENV_FILE"
  systemctl restart "$SERVICE" || true
  exit 1
fi

smtp_password=''
echo "SMTP do Brevo configurado e serviço de documentos reiniciado."
echo "Agora faça um envio de teste pelo botão E-mail do Portal."
