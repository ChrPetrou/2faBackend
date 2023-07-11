const rateLimit = require("express-rate-limit");

// Define the rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many requests, please try again after 15 minutes.",
});

// Then, export this as a middleware
module.exports = limiter;
