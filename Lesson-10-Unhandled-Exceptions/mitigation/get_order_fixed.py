# =============================================================
# ICS-344 Course Project - Lesson 10: Unhandled Exceptions
# MITIGATION: DVSA-ORDER-GET/get_order.py
#
# CHANGES MADE:
# 1. Replaced event["orderId"] with event.get("orderId")
# 2. Added validation for required fields
# 3. Wrapped entire handler in try/except
# 4. Generic error message returned to client
# 5. Full error details logged to CloudWatch only
#
# BEFORE (vulnerable):
#   orderId = event["orderId"]  # KeyError if missing!
#   userId  = event["user"]     # KeyError if missing!
#
# AFTER (fixed):
#   orderId = event.get("orderId")  # returns None if missing
#   userId  = event.get("user")     # returns None if missing
#   if not orderId or not userId: return generic error
# =============================================================

import json
import boto3
import os
import decimal
from boto3.dynamodb.conditions import Key, Attr

# status list
# -----------
# 100: open
# 110: payment-failed
# 120: paid
# 200: processing
# 210: shipped
# 300: delivered
# 500: cancelled
# 600: rejected

def lambda_handler(event, context):
    # FIX: Wrap entire handler in try/except
    try:
        print(json.dumps(event))

        # Helper class to convert a DynamoDB item to JSON
        class DecimalEncoder(json.JSONEncoder):
            def default(self, o):
                if isinstance(o, decimal.Decimal):
                    if o % 1 > 0:
                        return float(o)
                    else:
                        return int(o)
                return super(DecimalEncoder, self).default(o)

        # FIX: Use .get() instead of bracket notation to avoid KeyError
        orderId = event.get("orderId")
        userId = event.get("user")

        # FIX: Validate required fields before processing
        if not orderId or not userId:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "status": "err",
                    "message": "Missing required fields"
                })
            }

        is_admin = json.loads(event.get("isAdmin", "false").lower())
        address = "{}"

        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(os.environ["ORDERS_TABLE"])

        if is_admin:
            response = table.query(
                KeyConditionExpression=Key('orderId').eq(orderId)
            ).get("Items", [None])
        else:
            key = {"orderId": orderId, "userId": userId}
            response = [table.get_item(Key=key).get("Item")]

        res = (
            {"status": "ok", "order": response[0]}
            if response[0] is not None
            else {"status": "err", "msg": "could not find order"}
        )

        return json.loads(
            json.dumps(res, cls=DecimalEncoder)
            .replace("\\\"", "\"")
            .replace("\\n", "")
        )

    except Exception as e:
        # FIX: Log full details internally to CloudWatch only
        print(f"Internal error: {str(e)}")
        # FIX: Return only generic message to client - no stack trace!
        return {
            "statusCode": 500,
            "body": json.dumps({
                "status": "err",
                "message": "An internal error occurred"
            })
        }
