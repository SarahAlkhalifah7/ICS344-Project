# Lesson 10: Unhandled Exceptions

## Overview

| Field | Details |
|-------|---------|
| **Vulnerability** | Unhandled Exceptions / Information Disclosure |
| **Affected Functions** | `DVSA-ORDER-MANAGER` (Node.js) and `DVSA-ORDER-GET` (Python) |
| **API Endpoint** | `POST /dvsa/order` |
| **Impact** | Internal stack traces, file paths, line numbers, and source code leaked to client |
| **OWASP Category** | A05:2021 Security Misconfiguration |

---

## Quick Start

### Prerequisites
- Valid DVSA user account
- JWT token (see instructions below)
- Postman or PowerShell

### Get Your JWT Token
1. Open DVSA website in browser
2. Log in to your account
3. Press `F12` -> Network tab -> Fetch/XHR
4. Click **Orders** in DVSA menu
5. Copy the `Authorization` header value from the request

### Set Variables
```powershell
$API   = "https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/dvsa/order"
$TOKEN = "YOUR-JWT-TOKEN-HERE"
```

### Run the Exploit
```powershell
.\exploit\trigger_exception.ps1
```

---

## How the Vulnerability Works

### Root Cause 1 - DVSA-ORDER-MANAGER (Node.js)

```javascript
// VULNERABLE - No try/catch around JSON.parse
exports.handler = (event, context, callback) => {
    var req = JSON.parse(event.body); // crashes if invalid JSON!
    // ...
};
```

If `event.body` is not valid JSON, a `SyntaxError` is thrown and propagates directly to the client response, exposing:
- Internal file path: `/var/task/order-manager.js:11:24`
- Lambda runtime path: `/var/runtime/index.mjs:1306:29`

### Root Cause 2 - DVSA-ORDER-GET (Python)

```python
# VULNERABLE - Direct bracket access, no try/except
def lambda_handler(event, context):
    orderId = event["orderId"]  # KeyError if missing!
    userId  = event["user"]     # KeyError if missing!
```

If `orderId` is missing from the request, a `KeyError` is thrown and returned to the client with:
- Internal file path: `/var/task/get_order.py`
- Exact line number: `line 30`
- Function name: `lambda_handler`
- Actual source code: `orderId = event["orderId"]`

---

## Exploit

See `exploit/trigger_exception.ps1` for the full script.

### Test Requests

**Trigger KeyError in get_order.py:**
```json
{"action": "get"}
```

**Trigger SyntaxError in order-manager.js:**
```
this is not json
```

### Expected Vulnerable Response
```json
{
    "errorMessage": "'orderId'",
    "errorType": "KeyError",
    "stackTrace": [
        "  File \"/var/task/get_order.py\", line 30, in lambda_handler\n    orderId = event[\"orderId\"]\n"
    ]
}
```

---

## Loot

See `loot/` directory for:
- `stack_trace_response.json` - Actual leaked stack trace from the API
- `cloudwatch_error.json` - Actual CloudWatch error log showing SyntaxError
- `cloudwatch_warn.txt` - Internal Lambda implementation details leaked in logs

---

## Mitigation

See `mitigation/` directory for fixed code.

### Summary of Fixes

| File | Fix Applied |
|------|------------|
| `order-manager.js` | Wrapped `JSON.parse` in try/catch, added action field validation |
| `get_order.py` | Replaced `event["key"]` with `event.get("key")`, wrapped handler in try/except |

### Key Principle
- Log full error details **internally** to CloudWatch
- Return only **generic messages** to the client

---

## Verification After Fix

| Request | Before Fix | After Fix |
|---------|-----------|-----------|
| `{"action":"get"}` | Stack trace + `/var/task/get_order.py:30` | `An internal error occurred` |
| `{}` | `unknown action` | `Missing required fields` |
| `{"action":"orders"}` | `200 OK` (normal) | `200 OK` (normal) |

---

## Part 9 - Structured Analysis

Full Tables A and B are included in the project report:
`Report/ICS344_Final_Report_Lessons_6_10.docx`

---

## Takeaway

Error handling is a security control. Stack traces returned in API responses give attackers a precise map of internal file paths, function names, and source code - dramatically reducing the effort needed for deeper attacks. Always separate internal observability (CloudWatch) from external visibility (client responses).
