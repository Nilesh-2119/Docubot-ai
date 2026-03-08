import requests
import sys

BOT_ID = "034662f2-c1f6-4f53-b807-7a882d728505"
URL = f"https://docubot-backend-6fov.onrender.com/api/widget/{BOT_ID}/chat"

print(f"Testing {URL}", flush=True)

for i in range(1, 41):
    try:
        r = requests.post(URL, json={"message": "test", "session_id": "test"}, timeout=5)
        print(f"{i}: {r.status_code}", flush=True)
    except Exception as e:
        print(f"{i}: Error {e}", flush=True)

print("Done", flush=True)
