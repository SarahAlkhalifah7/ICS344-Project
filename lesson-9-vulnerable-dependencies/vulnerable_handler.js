const serialize = require('node-serialize');
const jose = require('node-jose');

exports.handler = (event, context, callback) => {
    // VULNERABLE: Using node-serialize to parse user input allows Remote Code Execution
    var req = serialize.unserialize(event.body); 
    var headers = serialize.unserialize(event.headers);
    
    var auth_header = headers.Authorization || headers.authorization;
    // ... rest of the application logic
};
