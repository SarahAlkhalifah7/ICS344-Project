const jose = require('node-jose');

exports.handler = (event, context, callback) => {
    // SECURE: Using native JSON.parse safely treats input as data, not executable code
    var req = JSON.parse(event.body); 
    var headers = JSON.parse(event.headers);
    
    var auth_header = headers.Authorization || headers.authorization;
    // ... rest of the application logic
};
