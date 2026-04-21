# Lesson #3: Sensitive Information Disclosure

## Vulnerability
Any user with AWS CLI access can invoke DVSA-ADMIN-GET-RECEIPT 
directly and download all users' receipts with no authentication.

## Exploit Command
```bash
aws lambda invoke \
  --function-name DVSA-ADMIN-GET-RECEIPT \
  --payload '{"year":"2026"}' \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  /tmp/receipt_response.json && cat /tmp/receipt_response.json | jq
```

## Fix
- Added ADMIN_SECRET environment variable to the Lambda function
- Added authorization check at the start of lambda_handler
- See fix/lambda_function.py for the patched code

## Verification
Without secret: returns {"status": "err", "msg": "unauthorized"}
With secret: returns download_url as expected
