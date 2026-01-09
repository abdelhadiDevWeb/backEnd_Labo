import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppConfig } from "../config/app.config";
import { AuthRequest } from "./auth.middleware";

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

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

      if (decoded && typeof decoded === "object" && "role" in decoded) {
        const role = decoded.role as string;
        if (role !== "admin") {
          res.status(403).json({
            success: false,
            message: "Admin access required",
          });
          return;
        }

        req.userId = decoded.id as string;
        req.userEmail = decoded.email as string;
        req.userRole = role;
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
      message: "Authorization error",
    });
  }
};

export const requireSupplier = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

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

      if (decoded && typeof decoded === "object" && "role" in decoded) {
        const role = decoded.role as string;
        if (role !== "supplier") {
          res.status(403).json({
            success: false,
            message: "Supplier access required",
          });
          return;
        }

        req.userId = decoded.id as string;
        req.userEmail = decoded.email as string;
        req.userRole = role;
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
      message: "Authorization error",
    });
  }
};

export const requireClient = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

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

      if (decoded && typeof decoded === "object" && "role" in decoded) {
        const role = decoded.role as string;
        if (role !== "client") {
          res.status(403).json({
            success: false,
            message: "Client access required",
          });
          return;
        }

        req.userId = decoded.id as string;
        req.userEmail = decoded.email as string;
        req.userRole = role;
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
      message: "Authorization error",
    });
  }
};

