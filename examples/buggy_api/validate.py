"""A deliberately buggy endpoint-like function, for a controlled agent benchmark."""


def create_user(payload):
    email = payload["email"].strip()  # BUG: KeyError for a missing email.
    if "@" not in email:
        return 400, {"error": "invalid email"}
    return 201, {"email": email}
