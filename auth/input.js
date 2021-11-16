const validator = require('validator');

function sanitize(input) {
    return validator.escape(input);
}