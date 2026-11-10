"""Use the operating system's per-user credential store."""
import ctypes as c
import json
import sys

SERVICE = b"io.github.tpskym.workshop.webdav"
ACCOUNT = b"mail"


def _mac(payload, service):
    api = c.CDLL("/System/Library/Frameworks/Security.framework/Security")
    core = c.CDLL("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation")
    pointer, size, data = c.c_void_p, c.c_uint32, c.c_char_p
    core.CFRelease.argtypes = [pointer]
    api.SecKeychainFindGenericPassword.argtypes = [
        pointer, size, data, size, data, c.POINTER(size), c.POINTER(pointer), c.POINTER(pointer)]
    api.SecKeychainAddGenericPassword.argtypes = [
        pointer, size, data, size, data, size, data, pointer]
    api.SecKeychainItemModifyAttributesAndData.argtypes = [pointer, pointer, size, data]
    api.SecKeychainItemFreeContent.argtypes = [pointer, pointer]
    key = (None, len(service), service, len(ACCOUNT), ACCOUNT)
    length, value, item = size(), pointer(), pointer()
    status = api.SecKeychainFindGenericPassword(
        *key, c.byref(length) if payload is None else None,
        c.byref(value) if payload is None else None, c.byref(item))
    try:
        if payload is None:
            if status == -25300:
                return None
            if status == 0:
                return c.string_at(value, length.value)
        elif status == -25300:
            status = api.SecKeychainAddGenericPassword(*key, len(payload), payload, None)
        elif status == 0:
            status = api.SecKeychainItemModifyAttributesAndData(item, None, len(payload), payload)
        if status:
            raise OSError(status, "Keychain")
    finally:
        if value:
            api.SecKeychainItemFreeContent(None, value)
        if item:
            core.CFRelease(item)


def _windows(payload, service):
    from ctypes import wintypes as w

    class Credential(c.Structure):
        _fields_ = [
            ("Flags", w.DWORD), ("Type", w.DWORD), ("TargetName", w.LPWSTR),
            ("Comment", w.LPWSTR), ("LastWritten", w.FILETIME),
            ("CredentialBlobSize", w.DWORD), ("CredentialBlob", c.c_void_p),
            ("Persist", w.DWORD), ("AttributeCount", w.DWORD),
            ("Attributes", c.c_void_p), ("TargetAlias", w.LPWSTR), ("UserName", w.LPWSTR),
        ]

    api = c.WinDLL("advapi32", use_last_error=True)
    entry = c.POINTER(Credential)
    api.CredReadW.argtypes = [w.LPCWSTR, w.DWORD, w.DWORD, c.POINTER(entry)]
    api.CredWriteW.argtypes = [entry, w.DWORD]
    api.CredFree.argtypes = [c.c_void_p]
    target = service.decode("ascii")
    if payload is not None:
        blob = c.create_string_buffer(payload)
        credential = Credential(Type=1, TargetName=target, CredentialBlobSize=len(payload),
                                CredentialBlob=c.cast(blob, c.c_void_p), Persist=2, UserName="Мастерская")
        if not api.CredWriteW(c.byref(credential), 0):
            raise c.WinError(c.get_last_error())
        return
    result = entry()
    if not api.CredReadW(target, 1, 0, c.byref(result)):
        code = c.get_last_error()
        if code == 1168:
            return None
        raise c.WinError(code)
    try:
        return c.string_at(result.contents.CredentialBlob, result.contents.CredentialBlobSize)
    finally:
        api.CredFree(result)


def system_vault(payload=None, purpose=""):
    service = SERVICE + purpose.encode("ascii")
    if sys.platform == "darwin":
        return _mac(payload, service)
    if sys.platform == "win32":
        return _windows(payload, service)
    raise OSError("Unsupported credential store")


def load():
    data = system_vault()
    return tuple(json.loads(data)) if data else None


def save(account, password):
    system_vault(json.dumps([account, password]).encode("utf-8"))


def backup_password():
    value = system_vault(purpose=".backup")
    return value.decode("utf-8") if value else None


def save_backup_password(value):
    system_vault(value.encode("utf-8"), purpose=".backup")
