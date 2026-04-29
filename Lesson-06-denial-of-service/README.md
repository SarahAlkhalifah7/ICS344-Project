# Lesson #6: Denial of Service (DoS)

## Overview

| Field | Details |
|-------|---------|
| **Vulnerability** | Denial of Service (DoS) |
| **Affected Component** | DVSA-ORDER-BILLING Lambda + API Gateway (dvsa stage) |
| **API Endpoint** | `POST https://REDACTED.execute-api.us-east-1.amazonaws.com/dvsa/order` |
| **Impact** | Availability loss - legitimate users cannot complete checkout during attack |
| **Root Cause** | No rate limiting, throttling, or concurrency controls on the billing endpoint |

---

## Part 1 - Goal and Vulnerability Summary

The billing endpoint in DVSA has no rate limiting or abuse protection. By sending a large number of concurrent billing requests, an attacker can exhaust Lambda concurrency, causing throttling errors for legitimate users attempting to complete checkout. The root cause is the complete absence of any rate limiting at the API Gateway level and no reserved concurrency cap at the Lambda level.

---

## Part 2 - Root Cause

AWS Lambda enforces a default regional concurrency limit. Each billing request occupies one concurrent execution slot. Because no rate limiting exists at API Gateway and no concurrency cap exists at Lambda, nothing prevents flooding the endpoint with hundreds of parallel requests simultaneously. When the concurrency limit is reached, Lambda throttles new invocations and returns `TooManyRequestsException` errors to legitimate users.

---

## Part 3 - Environment and Setup

**Prerequisites:**
- Valid DVSA user account
- JWT token (captured from browser DevTools)
- A real order ID (place one order through the DVSA website)
- PowerShell (Windows)
- Postman (for normal billing confirmation)
- AWS Console (CloudWatch metrics)

**Get JWT Token:**
1. Open DVSA website in browser and log in
2. Press `F12` → Network tab → Fetch/XHR
3. Click any order-related action
4. Copy the `Authorization` header value

**Get Order ID:**
1. Add item to cart and complete shipping step
2. Press `F12` → Network tab
3. Copy the `order-id` from the shipping response

---

## Part 4 - Reproduction Steps

### Step 1 - Confirm Normal Billing

Send one billing request in Postman:
```json
{
  "action": "billing",
  "order-id": "YOUR-ORDER-ID",
  "data": {
    "ccn": "4242424242424242",
    "exp": "12/26",
    "cvv": "123"
  }
}
```
**Expected result:** `200 OK` with `status: ok` and `amount` field - confirming normal billing works.

### Step 2 - Launch DoS Flood

Run the flood script from `exploit/dos_flood.ps1`:

```powershell
# Set your variables first
$API      = "YOUR-API-URL-HERE"
$TOKEN    = "YOUR-JWT-TOKEN-HERE"
$ORDER_ID = "YOUR-ORDER-ID-HERE"

# Then run the script
.\exploit\dos_flood.ps1
```

### Step 3 - Check CloudWatch Metrics

1. AWS Console → CloudWatch → All Metrics → Lambda → DVSA-ORDER-BILLING
2. Set Statistic to **Sum**, Period to **1 minute**
3. Check Invocations, Throttles, Errors, ConcurrentExecutions
4. Observe spikes confirming Lambda was overwhelmed

---

## Part 5 - Evidence and Proof

- Normal billing returns `200 OK` with no restrictions ✅
- 200 concurrent jobs caused **ConcurrentExecutions to spike to 538**
- CloudWatch metrics showed spikes in Invocations (292), Throttles (45), Errors (277), and ConcurrentExecutions (538)
- See `loot/` folder for screenshots

---

## Part 6 - Fix Strategy

Apply rate limiting at the API Gateway level:
- **API Gateway Stage Throttling:** Enable with Rate=100 req/sec and Burst=50 - causes API Gateway to return HTTP 429 before requests reach Lambda
- **Lambda Reserved Concurrency (optional):** Set concurrency cap on DVSA-ORDER-BILLING
- **SQS Queue (ideal long-term fix):** Decouple billing requests from processing

---

## Part 7 - Fix Applied

**Location:** AWS Console → API Gateway → DVSA-APIs → Stages → dvsa → Edit

| Setting | Before | After |
|---------|--------|-------|
| Throttling | Inactive | **Enabled** |
| Rate | 10,000 req/sec (default) | **100 req/sec** |
| Burst | 5,000 (default) | **50 requests** |

No code changes required - pure infrastructure configuration.

See full fix details in `mitigation/api_gateway_throttling.md`

---

## Part 8 - Verification After Fix

After applying throttling:
1. Re-ran 200-request flood → requests now receive **HTTP 429** immediately from API Gateway
2. CloudWatch shows **Throttles spiking** - requests rejected before reaching Lambda
3. Single legitimate billing request still returns **200 OK** ✅ - normal checkout unaffected

See `loot/` folder for before/after CloudWatch screenshots.

---

## Part 9 - Structured Operation and Security Analysis

### Table A - Intended Logic vs Exploit Behavior

| Vulnerability | Intended Rule(s) | Artifacts Used to Infer Rule | Normal Behavior Evidence | Exploit Behavior Evidence |
|---|---|---|---|---|
| Lesson #6: Denial of Service | The billing endpoint must process one legitimate billing request per order per user. It must not allow a single user to saturate Lambda concurrency or block other users from completing checkout. Rate limiting must be enforced at the API layer. | DVSA browser checkout workflow; API Gateway stage settings (no throttling configured); Lambda concurrency config; CloudWatch metrics (Invocations, Throttles, ConcurrentExecutions); PowerShell flood script output; Postman billing responses | A single billing request returns 200 OK with status:ok and amount. Other users can checkout concurrently. No errors occur under normal load. | 200 concurrent PowerShell jobs overwhelmed the endpoint. ConcurrentExecutions spiked to 538. CloudWatch showed massive spikes in Invocations, Throttles, and Errors. |

### Table B - Deviation Analysis and Fix

| Vulnerability | Why This Is a Deviation | Deviation Class | Fix Applied (Where) | Post-Fix Verification |
|---|---|---|---|---|
| Lesson #6: Denial of Service | The exploit violates the availability rule. The billing endpoint must remain accessible to all legitimate users at all times. Flooding it with 200 concurrent requests exhausted Lambda concurrency - directly violating the intended one-request-per-order fair-access model and denying service to real users. | Intentional Misuse / Security-Relevant Abuse | API Gateway (dvsa stage): enabled throttling with Rate=100 req/sec and Burst=50. Applied via AWS Console → API Gateway → Stages → dvsa → Edit. No code changes required. | After fix, flood requests receive HTTP 429 immediately from API Gateway. CloudWatch shows Throttles spiking. A single legitimate billing request still completes with 200 OK. |

---

## Part 10 - Takeaway

Availability is a security property, not merely a reliability concern. In serverless architectures, the shared concurrency model means that one unprotected endpoint can affect all users of the application. Unlike traditional servers where hardware provides natural throttling, serverless functions scale aggressively to consume all available concurrency if no explicit limits are configured.

The key secure design principle is **defense in depth for availability**: rate limiting at the API Gateway layer prevents excess requests from reaching compute resources entirely, while reserved concurrency at the Lambda layer provides an additional safety boundary. Even a simple throttling configuration - 100 requests/second with a burst of 50 - is sufficient to prevent the DoS attack demonstrated in this lesson while preserving normal functionality for legitimate users.

---

## Repository Structure

```
lesson-06-denial-of-service/
├── README.md                            ← this file
├── exploit/
│   └── dos_flood.ps1                    ← flood attack script
├── mitigation/
    └── api_gateway_throttling.md        ← fix details
```
