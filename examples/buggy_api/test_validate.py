import unittest
from validate import create_user


class TestCreateUser(unittest.TestCase):
    def test_valid_email(self):
        self.assertEqual(create_user({"email": "alice@example.org"}),
                         (201, {"email": "alice@example.org"}))

    def test_invalid_email(self):
        self.assertEqual(create_user({"email": "invalid"}),
                         (400, {"error": "invalid email"}))

    def test_missing_email(self):
        self.assertEqual(create_user({}), (400, {"error": "invalid email"}))


if __name__ == "__main__":
    unittest.main()
