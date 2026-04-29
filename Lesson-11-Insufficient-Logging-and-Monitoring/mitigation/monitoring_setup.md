# Fix: CloudWatch Monitoring Pipeline Setup

## Overview

The fix for Lesson #12 (Insufficient Logging and Monitoring) requires no Lambda code changes. Three new AWS resources must be created to build a complete detection pipeline on top of the existing DVSA deployment.

---

## Detection Pipeline

```
CloudWatch Logs -> Log Metric Filter -> CloudWatch Alarm -> SNS Topic -> Operator Email
```

---

## Before (Vulnerable)

| Component | Status |
|-----------|--------|
| CloudWatch Logs | Present (logs stored but ignored) |
| Log Metric Filter | Not configured |
| CloudWatch Alarm | Not configured |
| SNS Topic | Not configured |
| Operator Notification | Never delivered |

---

## After (Fixed)

| Component | Status |
|-----------|--------|
| CloudWatch Logs | Present |
| Log Metric Filter | DVSAFailedAuthFilter (matches ERROR lines) |
| CloudWatch Alarm | DVSA-BruteForce-FailedAuth (threshold >5 per minute) |
| SNS Topic | dvsa-security-alerts (email confirmed) |
| Operator Notification | Delivered within minutes of attack |

---

## How to Apply the Fix

Run the following three commands in AWS CloudShell. Replace REDACTED values with your own.

### Command 1 - Create SNS Topic and Subscribe Operator Email

```bash
aws sns create-topic --name dvsa-security-alerts --region us-east-1
```

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:YOUR-ACCOUNT-ID:dvsa-security-alerts \
  --protocol email \
  --notification-endpoint YOUR-EMAIL-HERE \
  --region us-east-1
```

After running, check your email inbox and click the confirmation link from AWS. The subscription status must be Confirmed before the pipeline works.

---

### Command 2 - Create the Log Metric Filter

```bash
aws logs put-metric-filter \
  --log-group-name "/aws/lambda/DVSA-ORDER-MANAGER" \
  --filter-name "DVSAFailedAuthFilter" \
  --filter-pattern '"ERROR"' \
  --metric-transformations \
  metricName=FailedAuthAttempts,metricNamespace=DVSA/Security,metricValue=1,defaultValue=0 \
  --region us-east-1
```

This filter scans every new log entry in the DVSA-ORDER-MANAGER log group. Any line containing ERROR increments the custom metric DVSA/Security/FailedAuthAttempts by 1.

---

### Command 3 - Create the CloudWatch Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "DVSA-BruteForce-FailedAuth" \
  --alarm-description "Fires when more than 5 Lambda crashes occur in 1 minute" \
  --metric-name "FailedAuthAttempts" \
  --namespace "DVSA/Security" \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:sns:us-east-1:YOUR-ACCOUNT-ID:dvsa-security-alerts" \
  --region us-east-1
```

The alarm fires when more than 5 ERROR lines appear in any 1-minute window. This threshold distinguishes a brute-force burst from occasional legitimate errors.

---

## Verification

After applying the fix, re-run the attack script. You should observe:
- Alarm transitions from OK to **ALARM** state
- An email notification arrives in the operator inbox within minutes
- CloudWatch console shows the alarm in red with a metric spike
- A single normal request does NOT trigger the alarm (stays below threshold of 5)
