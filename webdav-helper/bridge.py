"""Local Workshop bridge. Only the Workshop origin can call the fixed Mail endpoint."""
import base64
import errno
import http.client
import json
import os
import re
import shutil
import ssl
import threading
import xml.etree.ElementTree as xml
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

import backup_access
import vault

HOST = "webdav.cloud.mail.ru"
FOLDER = "/masterskaya_files"
PORT = 48739
ORIGIN = os.environ.get("WORKSHOP_WEBDAV_ORIGIN", "https://tpskym.github.io")
NAME = re.compile(r"workshop-(?:initial-transfer\.zip|sync-source\.json|sync-[0-9a-f-]{36}\.(?:zip|json)|access\.json)\Z")
MAX_ARCHIVE = 2 * 1024**3
MAX_METADATA = 2 * 1024**2


class Problem(Exception):
    def __init__(self, status, message, retry_after=None):
        self.status, self.message, self.retry_after = status, message, retry_after


def tls_context():
    try:
        import certifi
    except ImportError:
        return ssl.create_default_context()
    return ssl.create_default_context(cafile=certifi.where())


class Mail:
    def __init__(self, account, password, connector=http.client.HTTPSConnection):
        self.account = account
        self.authorization = "Basic " + base64.b64encode(f"{account}:{password}".encode()).decode("ascii")
        self.connector = connector

    @contextmanager
    def request(self, method, path, *, expected, body=None, headers=None):
        connection = self.connector(HOST, timeout=90, context=tls_context())
        try:
            connection.request(method, path, body=body,
                               headers={"Authorization": self.authorization, **(headers or {})})
            response = connection.getresponse()
            if response.status not in expected:
                code = response.status
                if code in (401, 403):
                    raise Problem(code, "Mail отклонил вход или доступ. Проверьте логин и пароль приложения.")
                if code == 404:
                    raise Problem(404, "Файл или папка в Облаке Mail пока отсутствует.")
                raise Problem(429 if code == 429 else 502, f"Облако Mail вернуло HTTP {code}.",
                              response.getheader("Retry-After"))
            yield response
        finally:
            connection.close()

    def ensure_folder(self):
        with self.request("PROPFIND", FOLDER + "/", expected=(207, 404), headers={"Depth": "0"}) as response:
            if response.status == 207:
                return
        with self.request("MKCOL", FOLDER, expected=(201, 405), headers={"Content-Length": "0"}):
            pass
        with self.request("PROPFIND", FOLDER + "/", expected=(207,), headers={"Depth": "0"}):
            pass

    def names(self):
        with self.request("PROPFIND", FOLDER + "/", expected=(207,), headers={"Depth": "1"}) as response:
            content = response.read(MAX_METADATA + 1)
        if len(content) > MAX_METADATA:
            raise Problem(502, "Список файлов WebDAV слишком большой.")
        root = xml.fromstring(content)
        names = set()
        for href in root.findall("{DAV:}response/{DAV:}href"):
            path = unquote(urlsplit(href.text or "").path)
            if path.startswith(FOLDER + "/"):
                name = path[len(FOLDER) + 1:]
                if NAME.fullmatch(name):
                    names.add(name)
        return sorted(names)


class WorkshopServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, mail=Mail, store=vault):
        super().__init__(address, Handler)
        self.mail, self.store = mail, store
        self.credential_lock = threading.Lock()
        self.loaded = False
        self.client = None
        self.backup_key_lock = threading.Lock()
        self.backup_key_loaded = False
        self.backup_key = None

    def current(self):
        with self.credential_lock:
            if not self.loaded:
                credentials = self.store.load()
                self.client = self.mail(*credentials) if credentials else None
                self.loaded = True
            return self.client

    def connect(self, account, password):
        client = self.mail(account, password)
        with self.credential_lock:
            client.ensure_folder()
            self.store.save(account, password)
            self.client, self.loaded = client, True


    def backup_password(self, password=None):
        with self.backup_key_lock:
            if password is not None:
                self.store.save_backup_password(password)
                self.backup_key, self.backup_key_loaded = password, True
            elif not self.backup_key_loaded:
                self.backup_key = self.store.backup_password()
                self.backup_key_loaded = True
            return self.backup_key


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def setup(self):
        super().setup()
        self.connection.settimeout(120)

    def allowed(self):
        return (self.headers.get("Origin") == ORIGIN and
                self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}")

    def headers_for(self, status, length=None, content_type=None, retry_after=None):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Expose-Headers", "Retry-After")
        self.send_header("X-Content-Type-Options", "nosniff")
        if length is not None:
            self.send_header("Content-Length", str(length))
        if content_type:
            self.send_header("Content-Type", content_type)
        if retry_after:
            self.send_header("Retry-After", retry_after)
        self.end_headers()

    def send_bytes(self, status, content, content_type="text/plain; charset=utf-8", retry_after=None):
        self.headers_for(status, len(content), content_type, retry_after)
        self.wfile.write(content)

    def send_json(self, value):
        self.send_bytes(200, json.dumps(value).encode(), "application/json")

    def do_OPTIONS(self):
        if not self.allowed():
            return self.send_error(403)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT")
        self.send_header("Access-Control-Allow-Headers", "X-Workshop-WebDAV, X-Workshop-Account, Content-Type")
        if self.headers.get("Access-Control-Request-Private-Network") == "true":
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def length(self, limit):
        value = self.headers.get("Content-Length", "")
        if not value.isascii() or not value.isdecimal() or len(value) > 12:
            raise Problem(411, "Не указан размер файла.")
        size = int(value)
        if size > limit:
            raise Problem(413, "Файл превышает допустимый размер.")
        return size

    def connection_settings(self):
        if self.command == "GET":
            client = self.server.current()
            return self.send_json({"account": client.account if client else ""})
        try:
            body = json.loads(self.rfile.read(self.length(8192)))
            account, password = body["account"].strip().lower(), body["password"]
            if not re.fullmatch(r"[\x21-\x39\x3b-\x7e]+@[\x21-\x39\x3b-\x7e]+", account):
                raise ValueError()
            if not isinstance(password, str) or not 1 <= len(password) <= 512:
                raise ValueError()
        except (TypeError, AttributeError, ValueError, KeyError):
            raise Problem(400, "Укажите почту Mail и пароль внешнего приложения.") from None
        self.server.connect(account, password)
        self.send_json({"account": account})

    def read_json(self, limit):
        try:
            return json.loads(self.rfile.read(self.length(limit)))
        except ValueError:
            raise Problem(400, "Не удалось прочитать запрос.") from None

    def backup_key_settings(self):
        if self.command == "POST":
            try:
                password = backup_access.validate_password(self.read_json(8192)["password"], creating=True)
            except (TypeError, KeyError, ValueError):
                raise Problem(400, "Введите пароль шифрования длиной от 12 до 256 символов.") from None
            self.server.backup_password(password)
        self.send_json({"configured": bool(self.server.backup_password())})

    def encrypt_access(self):
        password = self.server.backup_password()
        if not password:
            raise Problem(400, "Сначала сохраните пароль шифрования доступов.")
        try:
            encrypted = backup_access.seal(password, self.read_json(MAX_METADATA), self.server.store.load())
        except ValueError:
            raise Problem(400, "Проверьте токены и Client ID в разделе «API и доступы».") from None
        self.send_json(encrypted)

    def decrypt_access(self):
        body = self.read_json(MAX_METADATA)
        try:
            password = backup_access.validate_password(body["password"])
            marketplace, mail = backup_access.unseal(password, body["envelope"])
        except (TypeError, ValueError, KeyError):
            raise Problem(400, "Пароль не подошёл или файл доступов повреждён.") from None
        if body.get("restoreMail") and mail:
            self.server.connect(*mail)
        if body.get("rememberPassword"):
            self.server.backup_password(password)
        self.send_json({"marketplace": marketplace, "mailRestored": bool(body.get("restoreMail") and mail)})

    def cloud(self):
        client = self.server.current()
        if not client or self.headers.get("X-Workshop-Account") != client.account:
            raise Problem(409, "Подключите тот же аккаунт Mail, который использовали для этой базы.")
        if self.path == "/files" and self.command == "GET":
            return self.send_json(client.names())
        name = unquote(self.path.removeprefix("/files/"))
        if not self.path.startswith("/files/") or not NAME.fullmatch(name):
            raise Problem(404, "Неизвестный файл WebDAV.")
        path = FOLDER + "/" + name
        if self.command == "GET":
            with client.request("GET", path, expected=(200,)) as response:
                self.headers_for(200, response.getheader("Content-Length"), "application/octet-stream")
                try:
                    shutil.copyfileobj(response, self.wfile, 128 * 1024)
                except (OSError, http.client.HTTPException):
                    self.close_connection = True
        elif self.command == "PUT":
            length = self.length(MAX_ARCHIVE if name.endswith(".zip") else MAX_METADATA)
            def chunks():
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(remaining, 128 * 1024))
                    if not chunk:
                        raise Problem(400, "Передача файла прервана.")
                    remaining -= len(chunk)
                    yield chunk

            with client.request("PUT", path, expected=(200, 201, 204), body=chunks(),
                                headers={"Content-Length": str(length), "Content-Type": "application/octet-stream"}):
                pass
            self.headers_for(204)
        else:
            raise Problem(405, "Метод не поддерживается.")

    def dispatch(self):
        if not self.allowed() or self.headers.get("X-Workshop-WebDAV") != "1":
            return self.send_error(403)
        try:
            if self.path == "/connection" and self.command in ("GET", "POST"):
                return self.connection_settings()
            if self.path == "/backup-key" and self.command in ("GET", "POST"):
                return self.backup_key_settings()
            if self.path == "/access/encrypt" and self.command == "POST":
                return self.encrypt_access()
            if self.path == "/access/decrypt" and self.command == "POST":
                return self.decrypt_access()
            self.cloud()
        except Problem as error:
            self.send_bytes(error.status, error.message.encode(), retry_after=error.retry_after)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (ssl.SSLError, http.client.HTTPException, TimeoutError, xml.ParseError):
            self.send_bytes(502, "Связь с Облаком Mail прервалась. Обмен можно повторить.".encode())
        except OSError:
            self.send_bytes(503, "Не удалось обратиться к Облаку Mail или системному хранилищу доступов.".encode())

    do_GET = do_POST = do_PUT = dispatch


if __name__ == "__main__":
    try:
        with WorkshopServer(("127.0.0.1", PORT)) as server:
            server.serve_forever()
    except OSError as error:
        if error.errno not in (errno.EADDRINUSE, 10048):
            raise
