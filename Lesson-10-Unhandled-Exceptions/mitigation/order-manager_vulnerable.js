// =============================================================
// ICS-344 Course Project - Lesson 10: Unhandled Exceptions
// VULNERABLE (ORIGINAL): DVSA-ORDER-MANAGER/order-manager.js
//
// VULNERABILITY:
// Line 6: var req = JSON.parse(event.body);
// - No try/catch around JSON.parse
// - If body is invalid JSON -> SyntaxError propagates to client
// - Exposes: /var/task/order-manager.js:11:24
// - Exposes: /var/runtime/index.mjs:1306:29
// - Exposes: full Lambda runtime call stack
// =============================================================

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const jose = require('node-jose');

exports.handler = (event, context, callback) => {

    // VULNERABILITY: No try/catch - crashes if body is invalid JSON
    var req = JSON.parse(event.body);

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
                    callback(null, {
                        statusCode: 500,
                        headers: { "Access-Control-Allow-Origin": "*" },
                        body: JSON.stringify({ status: "err", message: err.message })
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
            callback(null, {
                statusCode: 500,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ status: "err", message: err.message })
            });
        });

    } catch (e) {
        callback(null, {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "err", message: e.message })
        });
    }
};
