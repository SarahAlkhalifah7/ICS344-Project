const result = await jose.JWS.createVerify().verify(auth_header);
const token = JSON.parse(result.payload.toString());
var user = token.username;
