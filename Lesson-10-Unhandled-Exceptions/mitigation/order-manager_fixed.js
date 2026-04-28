// =============================================================
// ICS-344 Course Project - Lesson 10: Unhandled Exceptions
// MITIGATION: DVSA-ORDER-MANAGER/order-manager.js
//
// CHANGES MADE:
// 1. Added try/catch around JSON.parse(event.body)
// 2. Added input validation for required 'action' field
// 3. Generic error messages returned to client only
// 4. Full details logged to CloudWatch internally
//
// BEFORE (vulnerable - line 6):
//   var req = JSON.parse(event.body); // crashes if invalid JSON!
//
// AFTER (fixed):
//   try { req = JSON.parse(event.body); }
//   catch (parseErr) { return generic error; }
// =============================================================

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const jose = require('node-jose');

exports.handler = (event, context, callback) => {

    // FIX 1: Safely parse request body with try/catch
    var req;
    try {
        req = JSON.parse(event.body);
    } catch (parseErr) {
        // Log internally for debugging
        console.error("JSON parse error:", parseErr.message);
        // Return generic message to client - no internal details!
        return callback(null, {
            statusCode: 400,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "err", message: "Invalid request format" })
        });
    }

    // FIX 2: Validate required fields before processing
    if (!req || !req.action) {
        return callback(null, {
            statusCode: 400,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "err", message: "Missing required fields" })
        });
    }

    var headers = event.headers || {};
    var auth_header = headers.Authorization || headers.authorization || "";
    var token_sections = auth_header.split('.');

    if (token_sections.length < 2) {
        return callback(null, {
            statusCode: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "err", message: "Invalid token" })
        });
    }

    var auth_data = jose.util.base64url.decode(token_sections[1]);
    var token = JSON.parse(auth_data);
    var user = token.username;
    var isAdmin = false;

    var params = {
        UserPoolId: process.env.userpoolid,
        Username: user
    };

    try {
        const cognitoidentityserviceprovider = new CognitoIdentityProviderClient();
        const command = new AdminGetUserCommand(params);

        cognitoidentityserviceprovider.send(command).then((userData) => {

            var len = userData.UserAttributes.length;

            for (var i = 0; i < len; i++) {
                if (userData.UserAttributes[i].Name === "custom:is_admin") {
                    isAdmin = userData.UserAttributes[i].Value;
                    break;
                }
            }

            var action = req.action;
            var isOk = true;
            var payload = {};
            var functionName = "";

            switch (action) {

                case "new":
                    payload = { user: user, cartId: req["cart-id"], items: req["items"] };
                    functionName = "DVSA-ORDER-NEW";
                    break;

                case "update":
                    payload = { user: user, orderId: req["order-id"], items: req["items"] };
                    functionName = "DVSA-ORDER-UPDATE";
                    break;

                case "cancel":
                    payload = { user: user, orderId: req["order-id"] };
                    functionName = "DVSA-ORDER-CANCEL";
                    break;

                case "get":
                    payload = { user: user, orderId: req["order-id"], isAdmin: isAdmin };
                    functionName = "DVSA-ORDER-GET";
                    break;

                case "orders":
                    payload = { user: user };
                    functionName = "DVSA-ORDER-ORDERS";
                    break;

                case "account":
                    payload = { user: user };
                    functionName = "DVSA-USER-ACCOUNT";
                    break;

                case "profile":
                    payload = { user: user, profile: req["data"] };
                    functionName = "DVSA-USER-PROFILE";
                    break;

                case "shipping":
                    payload = { user: user, orderId: req["order-id"], shipping: req["data"] };
                    functionName = "DVSA-ORDER-SHIPPING";
                    break;

                case "billing":
                    payload = { user: user, orderId: req["order-id"], billing: req["data"] };
                    functionName = "DVSA-ORDER-BILLING";
                    break;

                case "complete":
                    payload = { orderId: req["order-id"] };
                    functionName = "DVSA-ORDER-COMPLETE";
                    break;

                case "inbox":
                    payload = { action: "inbox", user: user };
                    functionName = "DVSA-USER-INBOX";
                    break;

                case "message":
                    payload = { action: "get", user: user, msgId: req["msg-id"], type: req["type"] };
                    functionName = "DVSA-USER-INBOX";
                    break;

                case "delete":
                    payload = { action: "delete", user: user, msgId: req["msg-id"] };
                    functionName = "DVSA-USER-INBOX";
                    break;

                case "upload":
                    payload = { user: user, file: req["attachment"] };
                    functionName = "DVSA-FEEDBACK-UPLOADS";
                    break;

                case "feedback":
                    return callback(null, {
                        statusCode: 200,
                        headers: { "Access-Control-Allow-Origin": "*" },
                        body: JSON.stringify({
                            status: "ok",
                            message: `Thank you ${req["data"]["name"]}.`
                        })
                    });

                case "admin-orders":
                    if (isAdmin == "true") {
                        payload = { user: user, data: req["data"] };
                        functionName = "DVSA-ADMIN-GET-ORDERS";
                        break;
                    } else {
                        return callback(null, {
                            statusCode: 403,
                            headers: { "Access-Control-Allow-Origin": "*" },
                            body: JSON.stringify({
                                status: "err",
                                message: "Unauthorized"
                            })
                        });
                    }

                default:
                    isOk = false;
            }

            if (isOk) {

                const invokeParams = {
                    FunctionName: functionName,
                    InvocationType: "RequestResponse",
                    Payload: JSON.stringify(payload)
                };

                const lambda_client = new LambdaClient();
                const invokeCommand = new InvokeCommand(invokeParams);

                lambda_client.send(invokeCommand).then((lambda_response) => {

                    const data = JSON.parse(Buffer.from(lambda_response.Payload).toString());

                    callback(null, {
                        statusCode: 200,
                        headers: { "Access-Control-Allow-Origin": "*" },
                        body: JSON.stringify(data)
                    });

                }).catch(err => {
                    // Log internally only
                    console.error("Lambda invoke error:", err);
                    callback(null, {
                        statusCode: 500,
                        headers: { "Access-Control-Allow-Origin": "*" },
                        body: JSON.stringify({ status: "err", message: "An internal error occurred" })
                    });
                });

            } else {

                callback(null, {
                    statusCode: 400,
                    headers: { "Access-Control-Allow-Origin": "*" },
                    body: JSON.stringify({ status: "err", message: "unknown action" })
                });
            }

        }).catch(err => {
            // Log internally only
            console.error("Cognito error:", err);
            callback(null, {
                statusCode: 500,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ status: "err", message: "An internal error occurred" })
            });
        });

    } catch (e) {
        // Log internally only
        console.error("Handler error:", e);
        callback(null, {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "err", message: "An internal error occurred" })
        });
    }
};
