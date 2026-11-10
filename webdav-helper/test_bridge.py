import io
import json
import threading
import unittest
from contextlib import contextmanager
from http.client import HTTPConnection

from bridge import FOLDER, ORIGIN, Mail, WorkshopServer


class MemoryStore:
    mail = None
    password = None

    def load(self):
        return self.mail

    def save(self, account, password):
        self.mail = account, password

    def backup_password(self):
        return self.password

    def save_backup_password(self, password):
        self.password = password


class FakeResponse(io.BytesIO):
    def __init__(self, status, body=b""):
        super().__init__(body)
        self.status = status
        self.size = len(body)

    def getheader(self, name):
        return str(self.size) if name == "Content-Length" else None


class FakeMail(Mail):
    def __init__(self, account, password):
        super().__init__(account, password)
        self.directory = False
        self.files = {}

    @contextmanager
    def request(self, method, path, *, expected, body=None, headers=None):
        if method == "PROPFIND" and path == FOLDER + "/":
            names = "".join(f"<response><href>{path}{name}</href></response>" for name in self.files)
            response = FakeResponse(207 if self.directory else 404,
                                    f'<multistatus xmlns="DAV:">{names}</multistatus>'.encode())
        elif method == "MKCOL" and path == FOLDER:
            self.directory = True
            response = FakeResponse(201)
        elif method == "PUT":
            self.files[path.rsplit("/", 1)[1]] = b"".join(body)
            response = FakeResponse(201)
        elif method == "GET":
            response = FakeResponse(200, self.files[path.rsplit("/", 1)[1]])
        else:
            raise AssertionError((method, path))
        assert response.status in expected
        yield response


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryStore()
        self.server = WorkshopServer(("127.0.0.1", 0), mail=FakeMail, store=self.store)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def request(self, method, path, body=None, **headers):
        connection = HTTPConnection("127.0.0.1", self.server.server_port)
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        try:
            connection.request(method, path, body, headers={
                "Origin": ORIGIN, "X-Workshop-WebDAV": "1",
                "X-Workshop-Account": "seller@example.test", **headers})
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def test_connect_creates_folder_and_round_trips_archive(self):
        login = {"account": "seller@example.test", "password": "fake-mail-password"}
        self.assertEqual(self.request("POST", "/connection", login)[0], 200)
        self.assertTrue(self.server.current().directory)
        self.assertEqual(self.request("GET", "/connection"), (200, b'{"account": "seller@example.test"}'))
        path = "/files/workshop-initial-transfer.zip"
        self.assertEqual(self.request("PUT", path, b"archive")[0], 204)
        self.assertEqual(json.loads(self.request("GET", "/files")[1]), ["workshop-initial-transfer.zip"])
        self.assertEqual(self.request("GET", path), (200, b"archive"))
        self.assertEqual(self.request("GET", path, **{"X-Workshop-Account": "another@example.test"})[0], 409)
        self.assertEqual(self.request("PUT", "/files/other.zip", b"x")[0], 404)
        self.assertEqual(self.request("GET", "/connection", Origin="https://example.com")[0], 403)
        self.assertEqual(WorkshopServer.current(self.server).account, login["account"])

    def test_encrypted_access_requires_correct_password_and_explicit_mail_restore(self):
        login = {"account": "seller@example.test", "password": "fake-mail-password"}
        self.request("POST", "/connection", login)
        password = "backup-test-password"
        self.assertEqual(self.request("POST", "/backup-key", {"password": password}), (200, b'{"configured": true}'))
        self.assertEqual(self.request("GET", "/backup-key"), (200, b'{"configured": true}'))
        credentials = {"wbToken": "fake-wb-token", "ozonKey": "fake-ozon-key", "ozonClient": "123"}
        status, body = self.request("POST", "/access/encrypt", credentials)
        self.assertEqual(status, 200)
        for secret in (login["password"], credentials["wbToken"], password):
            self.assertNotIn(secret.encode(), body)
        envelope = json.loads(body)
        self.assertEqual(self.request("POST", "/access/decrypt", {"envelope": envelope, "password": "wrong"})[0], 400)
        _, decrypted = self.request("POST", "/access/decrypt", {"envelope": envelope, "password": password})
        self.assertEqual(json.loads(decrypted), {"marketplace": credentials, "mailRestored": False})
        self.assertNotIn(login["password"].encode(), decrypted)
        _, restored = self.request("POST", "/access/decrypt", {"envelope": envelope, "password": password, "restoreMail": True})
        self.assertTrue(json.loads(restored)["mailRestored"])
