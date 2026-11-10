"""Portable encrypted file for Workshop credentials."""
import hashlib
import json
import os
import re

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

AAD = b"workshop-access-vault:v1"
TOKEN_FIELDS = ("wbToken", "ozonKey", "ozonClient")


def validate_password(value, *, creating=False):
    if not isinstance(value, str) or not (12 if creating else 1) <= len(value) <= 256:
        raise ValueError()
    return value


def tokens(values):
    if not isinstance(values, dict) or any(
        not isinstance(values.get(field), str) or len(values[field]) > 20000 for field in TOKEN_FIELDS
    ):
        raise ValueError()
    if values["ozonClient"] and not re.fullmatch(r"[0-9]+", values["ozonClient"]):
        raise ValueError()
    return {field: values[field] for field in TOKEN_FIELDS}


def cipher(password, salt):
    return AESGCM(hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000))


def seal(password, marketplace, mail):
    salt, nonce = os.urandom(16), os.urandom(12)
    data = json.dumps({"marketplace": tokens(marketplace), "mail": mail}, ensure_ascii=False).encode()
    ciphertext = cipher(password, salt).encrypt(nonce, data, AAD)
    return {"version": 1, "salt": salt.hex(), "iv": nonce.hex(), "ciphertext": ciphertext.hex()}


def unseal(password, envelope):
    try:
        if envelope["version"] != 1:
            raise ValueError()
        salt, nonce, ciphertext = (bytes.fromhex(envelope[key]) for key in ("salt", "iv", "ciphertext"))
        if len(salt) != 16 or len(nonce) != 12 or not 16 <= len(ciphertext) <= 500_000:
            raise ValueError()
        data = json.loads(cipher(password, salt).decrypt(nonce, ciphertext, AAD))
        marketplace = tokens(data["marketplace"])
        mail = data.get("mail")
        if mail is not None and (
            not isinstance(mail, list) or len(mail) != 2 or not all(isinstance(value, str) for value in mail)
        ):
            raise ValueError()
        return marketplace, mail
    except (AttributeError, TypeError, ValueError, KeyError, InvalidTag):
        raise ValueError() from None
