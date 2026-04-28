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
