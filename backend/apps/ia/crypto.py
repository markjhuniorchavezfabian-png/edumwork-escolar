"""Cifrado simétrico de API keys con Fernet (reciclado de p_02)."""
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken

_fernet = None


def _f() -> Fernet:
    global _fernet
    if _fernet is None:
        clave = settings.IA_ENCRYPTION_KEY
        if isinstance(clave, str):
            clave = clave.encode()
        _fernet = Fernet(clave)
    return _fernet


def cifrar(texto: str) -> str:
    if not texto:
        return ""
    return _f().encrypt(texto.encode()).decode()


def descifrar(cifrado: str) -> str:
    if not cifrado:
        return ""
    try:
        return _f().decrypt(cifrado.encode()).decode()
    except InvalidToken:
        return ""


def enmascarar(texto: str, visible: int = 4) -> str:
    if not texto or len(texto) <= visible + 3:
        return "•" * len(texto or "")
    return f"{texto[:3]}{'•' * 8}{texto[-visible:]}"
