import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppConfig } from "../config/app.config";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token required",
      });
      return;
    }

    jwt.verify(token, AppConfig.JwtSecret, (err, decoded) => {
      if (err) {
        res.status(403).json({
          success: false,
          message: "Invalid or expired token",
        });
        return;
      }

      if (decoded && typeof decoded === "object" && "id" in decoded) {
        req.userId = decoded.id as string;
        req.userEmail = decoded.email as string;
        next();
      } else {
        res.status(403).json({
          success: false,
          message: "Invalid token payload",
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

