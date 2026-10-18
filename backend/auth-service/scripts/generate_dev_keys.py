"""Gera chaves RSA apenas para desenvolvimento local.

Os arquivos resultantes ficam em `secrets/`, diretório ignorado pelo Git. Em
produção, as chaves devem ser gerenciadas fora do repositório.
"""

from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


target = Path(__file__).resolve().parents[1] / "secrets"
target.mkdir(exist_ok=True)
private_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)

(target / "jwt-private.pem").write_bytes(
    private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
)
(target / "jwt-public.pem").write_bytes(
    private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
)
print(f"Chaves de desenvolvimento criadas em {target}")

