import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// Rate limiter for authentication endpoints (login, register, password reset)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts, please try again later",
    });
  },
});

// Rate limiter for password update
export const passwordUpdateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 password updates per hour
  message: {
    success: false,
    message: "Too many password update attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for file uploads
export const fileUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 file uploads per hour
  message: {
    success: false,
    message: "Too many file uploads, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for product creation
export const productCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 product creations per hour
  message: {
    success: false,
    message: "Too many product creation requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for profile updates
export const profileUpdateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 profile updates per 15 minutes
  message: {
    success: false,
    message: "Too many profile update requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

