"""Cria ou atualiza um usuário sem expor a senha no terminal ou no histórico."""

import argparse
import getpass
from uuid import UUID

from app.database import close_pool, connection, open_pool
from app.security import hash_password


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--professional-id", required=True, type=UUID)
    parser.add_argument("--username", required=True)
    parser.add_argument("--role", required=True, action="append", dest="roles")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    password = getpass.getpass("Senha (mínimo 12 caracteres): ")
    if len(password) < 12:
        raise SystemExit("A senha precisa ter ao menos 12 caracteres.")

    open_pool()
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM identity.professionals WHERE id=%s AND active",
                (args.professional_id,),
            )
            if cur.fetchone() is None:
                raise SystemExit("Profissional ativo não encontrado.")

            cur.execute("SELECT code FROM identity.roles WHERE code = ANY(%s)", (args.roles,))
            valid_roles = {row["code"] for row in cur.fetchall()}
            if valid_roles != set(args.roles):
                raise SystemExit("Uma ou mais permissões informadas não existem.")

            cur.execute(
                """
                INSERT INTO identity.users (professional_id, username, password_hash)
                VALUES (%s, %s, %s)
                ON CONFLICT (username) DO UPDATE SET
                    professional_id=EXCLUDED.professional_id,
                    password_hash=EXCLUDED.password_hash,
                    active=TRUE, failed_attempts=0, locked_until=NULL,
                    password_changed_at=now(), updated_at=now()
                RETURNING id
                """,
                (args.professional_id, args.username.strip(), hash_password(password)),
            )
            user_id = cur.fetchone()["id"]
            cur.execute("DELETE FROM identity.user_roles WHERE user_id=%s", (user_id,))
            cur.executemany(
                "INSERT INTO identity.user_roles (user_id, role_code) VALUES (%s, %s)",
                [(user_id, role) for role in sorted(set(args.roles))],
            )

        print(f"Usuário {args.username} criado/atualizado com sucesso.")
    finally:
        close_pool()


if __name__ == "__main__":
    main()
