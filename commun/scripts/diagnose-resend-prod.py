import json
import urllib.request

env = {}
with open("/opt/onscen/.env", encoding="utf-8", errors="replace") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k] = v.strip().strip("'").strip('"')

from_addr = env.get("RESEND_FROM", "")
key = env.get("RESEND_API_KEY", "").strip()
print("APP_ENV=", env.get("APP_ENV", ""))
print("RESEND_FROM=", from_addr)
print("KEY_LEN=", len(key), "PREFIX=", (key[:3] if key else "MISS"))
print("ALERT_EMAIL=", env.get("ALERT_EMAIL", ""))
print("SMTP_ADMIN_EMAIL=", env.get("SMTP_ADMIN_EMAIL", ""))
print("GOOGLE_OAUTH_PROD_ENABLED=", env.get("GOOGLE_OAUTH_PROD_ENABLED", "MISS"))
print("GOOGLE_CALLBACK=", env.get("GOOGLE_CALLBACK_URL", ""))

req = urllib.request.Request(
    "https://api.resend.com/domains",
    headers={"Authorization": "Bearer " + key},
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.loads(r.read().decode())
    for d in data.get("data", []):
        print("DOMAIN", d.get("name"), "status=", d.get("status"))
except Exception as e:
    print("DOMAINS_API_ERROR", type(e).__name__, str(e)[:200])
