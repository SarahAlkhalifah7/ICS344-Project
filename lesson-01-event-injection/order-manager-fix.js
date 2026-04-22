// node-serialize removed - replaced with safe JSON.parse()

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const jose = require('node-jose');

exports.handler = (event, context, callback) => {
    var req = JSON.parse(event.body);      // FIXED: was serialize.unserialize()
    var headers = event.headers;            // FIXED: was serialize.unserialize()
    var auth_header = headers.Authorization || headers.authorization;
    var token_sections = auth_header.split('.');
    var auth_data = jose.util.base64url.decode(token_sections[1]);
    var token = JSON.parse(auth_data);
    var user = token.username;
    var isAdmin = false;
    // ... rest of original code unchanged
}
