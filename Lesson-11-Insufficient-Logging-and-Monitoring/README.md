# Lesson #12: Insufficient Logging and Monitoring (Bonus)

## Overview

| Field | Details |
|-------|---------|
| **Vulnerability** | Insufficient Logging and Monitoring |
| **Affected Component** | DVSA-ORDER-MANAGER Lambda + AWS monitoring layer |
| **Log Group** | `/aws/lambda/DVSA-ORDER-MANAGER` |
| **Impact** | Complete attack blindness - brute-force bursts go undetected indefinitely |
| **Root Cause** | No metric filter, alarm, or SNS notification channel configured on top of CloudWatch Logs |

---

## Part 1 - Goal and Vulnerability Summary

DVSA deploys Lambda functions, API Gateway, Cognito, DynamoDB, and CloudWatch Logs out of the box. What it does not deploy is any active monitoring layer on top of those logs. An attacker who repeatedly sends malformed or unauthorized requests causes the Lambda to crash on every attempt, generating a stream of ERROR log entries in CloudWatch. However, because no metric filter, alarm, or notification channel exists, those errors accumulate silently and the system owner receives no indication that anything unusual is happening. The security impact is complete blindness to active attacks.

---

## Part 2 - Root Cause

CloudWatch Logs is a storage service. It receives and retains log entries but takes no action on their content unless explicitly configured to do so. Three components are missing from the default DVSA deployment:

1. A Log Metric Filter that scans log text and increments a numeric counter when a matching pattern appears
2. A CloudWatch Alarm that watches that counter and transitions to ALARM state when a threshold is crossed
3. An SNS topic with a confirmed subscriber that delivers the alarm signal to a real person

Without all three, an attacker can generate any number of backend failures and the owner will never know.

---

## Part 3 - Environment and Setup

- **API Endpoint:** `POST https://REDACTED.execute-api.us-east-1.amazonaws.com/dvsa/order`
- **Target Lambda:** DVSA-ORDER-MANAGER
- **Target Log Group:** /aws/lambda/DVSA-ORDER-MANAGER
- **AWS Region:** us-east-1
- **Tools:** AWS CloudShell (attack + fix), AWS Console (verification)
- **Account Context:** Valid AWS course account authenticated via CloudShell

---

## Part 4 - Reproduction Steps

### Step 1 - Verify No Alarms Exist
```bash
aws cloudwatch describe-alarms --region us-east-1 --query 'MetricAlarms[*].AlarmName'
# Expected: []
```

### Step 2 - Set Variables
```bash
export API="YOUR-API-URL-HERE"
```

### Step 3 - Run Attack
```bash
# Or run: ./exploit/brute_force.sh
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" "$API" \
    -H "content-type: application/json" \
    -H "authorization: Bearer invalid.token.$i" \
    --data-raw '{"action":"orders"}'
done
```

### Step 4 - Check CloudWatch
Navigate to CloudWatch -> Log groups -> /aws/lambda/DVSA-ORDER-MANAGER. Observe 50 ERROR lines with no alarm firing.

---

## Part 5 - Evidence and Proof

- Empty `[]` alarms list confirms zero monitoring before fix
- 50 x 502 responses confirm attack reached and crashed Lambda every time
- CloudWatch ERROR logs confirm failures were recorded but produced no alert

See `loot/` folder for screenshots.

---

## Part 6 - Fix Strategy

Build a detection pipeline on top of the existing log group:

```
CloudWatch Logs -> Log Metric Filter -> CloudWatch Alarm -> SNS Topic -> Operator Email
```

Full fix details in `mitigation/monitoring_setup.md`

---

## Part 7 - Fix Applied

Three new AWS resources created via AWS CloudShell:

| Resource | Name | Purpose |
|----------|------|---------|
| SNS Topic | dvsa-security-alerts | Notification delivery channel |
| Log Metric Filter | DVSAFailedAuthFilter | Translates ERROR logs into numeric metric |
| CloudWatch Alarm | DVSA-BruteForce-FailedAuth | Fires when >5 errors per minute |

No Lambda code changes required.

---

## Part 8 - Verification After Fix

After applying the fix, the same 50-request attack was re-run:
- Alarm transitioned to **ALARM** state with datapoint 50.0 exceeding threshold 5.0
- Operator email received from AWS Notifications within minutes
- CloudWatch console showed red alarm with metric spike
- Single legitimate request did NOT trigger the alarm

---

## Part 9 - Structured Analysis Tables

### Table A - Intended Logic vs Exploit Behavior

| Vulnerability | Intended Rule(s) | Artifacts Used | Normal Behavior Evidence | Exploit Behavior Evidence |
|---|---|---|---|---|
| Insufficient Logging and Monitoring | The system must detect sustained error bursts (>5 per minute) and notify an operator. Log storage alone does not satisfy this requirement. | CloudWatch Logs stream, CloudWatch Alarms list, SNS subscription status, curl attack output, operator email inbox | Post-fix: single normal request produces 0 metric increments, alarm stays OK, no email sent | Pre-fix: 50 attack requests produced 50 ERROR log lines. Alarm list returned []. No metric, no threshold, no notification. Detection latency was infinite. |

### Table B - Deviation Analysis and Fix

| Vulnerability | Why This Is a Deviation | Deviation Class | Fix Applied | Post-Fix Verification | Latency Before / After |
|---|---|---|---|---|---|
| Insufficient Logging and Monitoring | Pre-fix system silently absorbed 50 attack-induced crashes without producing any security signal. Logs existed but no pipeline converted them into actionable alerts, violating the requirement for active detection and notification. | Accidental misconfiguration - alerting and detection layer never deployed | SNS topic dvsa-security-alerts + metric filter DVSAFailedAuthFilter + alarm DVSA-BruteForce-FailedAuth (>5/min), all created via AWS CloudShell | Alarm reached ALARM state with datapoint 50.0, email delivered to operator inbox, CloudWatch console confirmed red alarm state | Before: infinite (never detected). After: under 2 minutes from attack to email. |

---

## Part 10 - Takeaway

This lesson exposed the difference between log storage and active monitoring. In a serverless environment there is no server administrator watching a terminal, no syslog daemon, and no host-based IDS. The AWS control plane is the only visibility layer available and it only works if explicitly configured. The fix required just three CLI commands and no code changes, showing the barrier to basic monitoring is low. Every production serverless application needs an end-to-end detection pipeline where logs feed metrics, metrics feed alarms, and alarms reach a human.

---

## Repository Structure

```
lesson-12-insufficient-logging-monitoring/
├── README.md                          <- this file
├── exploit/
│   └── brute_force.sh                 <- curl brute-force attack script
├── mitigation/
    └── monitoring_setup.md            <- 3 AWS CLI fix commands

```
