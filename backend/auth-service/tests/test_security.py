from app.security import hash_password, verify_password


def test_argon2_hash_does_not_expose_password():
    password = "Senha-de-teste-123!"
    password_hash = hash_password(password)
    assert password not in password_hash
    assert password_hash.startswith("$argon2id$")
    assert verify_password(password, password_hash)
    assert not verify_password("senha-incorreta", password_hash)

