# Fix: API Gateway Stage Throttling

## Overview

The fix for Lesson #6 (DoS) is a pure infrastructure configuration change at the API Gateway stage level. No code changes are required.

---

## Fix Location

**AWS Console → API Gateway → DVSA-APIs → Stages → dvsa → Edit**

---

## Before (Vulnerable)

| Setting | Value |
|---------|-------|
| Throttling | **Inactive** |
| Rate | 10,000 requests/second (AWS default) |
| Burst | 5,000 requests (AWS default) |
| Protection | None |

---

## After (Fixed)

| Setting | Value |
|---------|-------|
| Throttling | **Enabled** |
| Rate | **100 requests/second** |
| Burst | **50 requests** |

---

## How to Apply the Fix

1. Open **AWS Console**
2. Search for **API Gateway** and click on it
3. Click on **DVSA-APIs**
4. Click **Stages** in the left menu
5. Click on the **dvsa** stage
6. Click the **Edit** button
7. Find the **Throttling** section
8. Toggle throttling to **Enabled**
9. Set **Rate** to `100`
10. Set **Burst** to `50`
11. Click **Save**

---

## Why This Works

API Gateway throttling acts as the first line of defense before requests reach Lambda:

```
Client Request
      ↓
API Gateway (Rate Limit Check)
      ↓
If within limit → Lambda executes normally → 200 OK
If over limit   → API Gateway rejects immediately → 429 Too Many Requests
```

By setting a rate of 100 req/sec, any flood attempt is blocked at the API Gateway layer without Lambda ever being invoked - eliminating both the availability impact and unnecessary Lambda costs.

---

## Verification

After applying the fix, re-run the flood script. You should observe:
- Most requests return **HTTP 429 Too Many Requests** immediately
- CloudWatch **Throttles** metric spikes (requests rejected by API Gateway)
- CloudWatch **Invocations** and **ConcurrentExecutions** are much lower than before
- A single legitimate billing request still returns **200 OK** ✅
