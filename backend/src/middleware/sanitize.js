function sanitizeString(val, maxLen) {
  if (typeof val !== 'string') return val;
  return val.trim().slice(0, maxLen);
}

// Usage: router.post('/login', sanitizeBody({ email: 255, password: 128 }), handler)
function sanitizeBody(fields) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      for (const [field, maxLen] of Object.entries(fields)) {
        if (req.body[field] !== undefined) {
          req.body[field] = sanitizeString(req.body[field], maxLen);
        }
      }
    }
    next();
  };
}

module.exports = { sanitizeBody };
