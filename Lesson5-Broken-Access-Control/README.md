# Lesson 5: Broken Access Control — DVSA-ADMIN-UPDATE-ORDERS
 
## Overview
 
This folder contains the code changes for Lesson 5 of the DVSA security project.
 
- `admin_update_orders_before.py` — vulnerable version (no authorization check)
- `admin_update_orders_after.py` — fixed version (admin group check enforced)
---
 
## Vulnerability Summary
 
A normal authenticated user could invoke the `DVSA-ADMIN-UPDATE-ORDERS` Lambda function directly and modify any order status to "paid" without completing actual payment.
 
**Root Cause:** The function decoded the JWT token to extract the username but never verified whether the caller belongs to an administrator Cognito group.
 
---
 
## Exploit
 
Using AWS Lambda Test with a normal user JWT token and a target order-id, the attacker sent:
 
```json
{
  "headers": {
    "Authorization": "NORMAL_USER_JWT"
  },
  "body": {
    "action": "update",
    "order-id": "f0c9d76b-bedf-4e10-92be-af130dde9098",
    "item": {
      "itemList": {"10015": 1},
      "status": 120,
      "address": "Dhahran",
      "token": "test123",
      "ts": 1775840000,
      "total": 35,
      "userId": "44d884f8-00d1-704e-3e75-695a56c8cef9"
    }
  }
}
```
 
**Result before fix:**
```json
{"status": "ok", "msg": "order updated"}
```
 
The order status changed to **paid** with total **$35** and confirmation token **test123** without any real payment.
 
---
 
## Fix
 
Added an admin group check immediately after JWT decoding in `lambda_handler`.
 
**Result after fix:**
```json
{"status": "err", "msg": "Forbidden: admin only"}
```
 
---
 

