"""Cria o usuário administrador de demonstração sem senha fixa no repositório."""

import getpass
from uuid import UUID

from app.database import close_pool, connection, open_pool
from app.security import hash_password


professional_id = UUID("10000000-0000-4000-8000-000000000001")
username = input("Usuário administrativo [admin]: ").strip() or "admin"
password = getpass.getpass("Senha (mínimo 12 caracteres): ")
if len(password) < 12:
    raise SystemExit("A senha precisa ter ao menos 12 caracteres.")

open_pool()
try:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO identity.users (professional_id, username, password_hash)
            VALUES (%s, %s, %s)
            ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash,
                active=TRUE, failed_attempts=0, locked_until=NULL, updated_at=now()
            RETURNING id
            """,
            (professional_id, username, hash_password(password)),
        )
        user_id = cur.fetchone()["id"]
        cur.execute(
            "INSERT INTO identity.user_roles (user_id, role_code) VALUES (%s, 'ADMIN') ON CONFLICT DO NOTHING",
            (user_id,),
        )
    print(f"Usuário {username} criado/atualizado com sucesso.")
finally:
    close_pool()

