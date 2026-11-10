"""Round trip through the native vault in separate processes with disposable values."""
import subprocess
import sys
import uuid

from vault import SERVICE, system_vault


def verify():
    sample = "fake-passphrase-Ж".encode("utf-8")
    purpose = ".test-" + str(uuid.uuid4())
    system_vault(sample, purpose)
    try:
        subprocess.run([sys.executable, __file__, purpose], check=True)
    finally:
        target = (SERVICE + purpose.encode("ascii")).decode("ascii")
        if sys.platform == "darwin":
            subprocess.run(["security", "delete-generic-password", "-s", target, "-a", "mail"], check=True)
        elif sys.platform == "win32":
            import ctypes
            if not ctypes.windll.advapi32.CredDeleteW(target, 1, 0):
                raise OSError("Could not delete test credential")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        assert system_vault(purpose=sys.argv[1]) == "fake-passphrase-Ж".encode("utf-8")
    else:
        verify()
