import requests
import time

BOT_ID = "034662f2-c1f6-4f53-b807-7a882d728505"
URL = f"https://docubot-backend-6fov.onrender.com/api/widget/{BOT_ID}/chat"

print(f"🚀 Starting rate limit test against {URL}...")

success_count = 0
rate_limited_count = 0

for i in range(1, 41):
    payload = {
        "message": f"Rate limit test message {i}",
        "session_id": "test-verification-session"
    }
    
    try:
        response = requests.post(URL, json=payload, timeout=10)
        status = response.status_code
        
        if status == 200:
            success_count += 1
            print(f"Request {i}: ✅ 200 OK")
        elif status == 429:
            rate_limited_count += 1
            print(f"Request {i}: 🛑 429 Too Many Requests")
        else:
            print(f"Request {i}: ❓ {status} - {response.text}")
            
    except Exception as e:
        print(f"Request {i}: ❌ Error: {e}")
    
    # Small sleep to avoid network congestion, but fast enough to hit the 60s window
    time.sleep(0.1)

print("\n--- Test Results ---")
print(f"200 OK: {success_count}")
print(f"429 Too Many Requests: {rate_limited_count}")

if rate_limited_count > 0:
    print("\n✅ VERIFICATION SUCCESS: Redis is correctly rate limiting traffic!")
else:
    print("\n❌ VERIFICATION FAILURE: No rate limiting observed. Check if REDIS_URL is set in Render.")
