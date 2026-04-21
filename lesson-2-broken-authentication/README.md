# Lesson 2 - Broken Authentication

## Overview

This lesson demonstrates a Broken Authentication vulnerability in DVSA where the backend trusted JWT payload claims without verifying the token signature.

An attacker was able to modify the JWT token fields (`username`, `sub`) and impersonate another user to access victim order data.

---

## Vulnerability Type

- Broken Authentication
- Improper JWT Validation
- Account Impersonation

---

## Affected Component

- API Gateway `/order`
- Lambda Function: `DVSA-ORDER-MANAGER`

---

## Exploitation Steps

1. Capture attacker JWT token.
2. Capture victim identity.
3. Modify attacker JWT payload.
4. Replace `username` and `sub` with victim values.
5. Send forged request to `/order`.
6. Victim orders were returned.

---

## Evidence

The forged token was accepted and the API returned victim order information.

---

## Root Cause

The application decoded the JWT payload directly using Base64 decoding and trusted identity claims without verifying the digital signature.

---

## Fix Applied

Replaced unsafe token decoding with secure JWT signature verification using `node-jose`.

### Vulnerable Code

```javascript
var auth_data = jose.util.base64url.decode(token_sections[1]);
var token = JSON.parse(auth_data);
var user = token.username;
