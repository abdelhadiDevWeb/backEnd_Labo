import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Client from "../../entity/Client";
import { registerSchema, loginSchema } from "./validation";
import { AppConfig } from "../../config/app.config";
import { AuthRequest } from "../../middleware/auth.middleware";

// Register function
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { firstName, lastName, email, password, phone, address } = value;

    // Check if client already exists
    const existingClient = await Client.findOne({ email: email.toLowerCase() });
    if (existingClient) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    // Hash password with bcrypt (salt rounds: 12 for high security)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new client
    const newClient = new Client({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
    });

    await newClient.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: newClient._id, email: newClient.email },
      AppConfig.JwtSecret,
      { expiresIn: "7d" }
    );

    // Return success response (don't send password)
    res.status(201).json({
      success: true,
      message: "Client registered successfully",
      data: {
        id: newClient._id,
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        email: newClient.email,
        phone: newClient.phone,
        address: newClient.address,
      },
      token,
    });
  } catch (err: unknown) {
    console.error("Register error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Login function
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { email, password } = value;

    // Find client by email and include password field
    const client = await Client.findOne({ email: email.toLowerCase() }).select("+password");
    if (!client) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, client.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: client._id, email: client.email },
      AppConfig.JwtSecret,
      { expiresIn: "7d" }
    );

    // Return success response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
      },
      token,
    });
  } catch (err: unknown) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get current user profile
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const client = await Client.findById(req.userId);
    if (!client) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Get profile error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update user profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    // Validate input
    if (!firstName || !lastName) {
      res.status(400).json({
        success: false,
        message: "First name and last name are required",
      });
      return;
    }

    const client = await Client.findById(req.userId);
    if (!client) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Update fields
    client.firstName = firstName;
    client.lastName = lastName;
    if (phone) client.phone = phone;
    if (address) client.address = address;

    await client.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
        updatedAt: client.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Update profile error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update password
export const updatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
      return;
    }

    // Find client with password field
    const client = await Client.findById(req.userId).select("+password");
    if (!client) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, client.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
      return;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    client.password = hashedPassword;
    await client.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err: unknown) {
    console.error("Update password error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get connected devices (simplified - in production, you'd track this in database)
export const getDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // In a real application, you would store device information in the database
    // For now, we'll return a simplified response based on user agent
    const userAgent = req.headers["user-agent"] || "Unknown";
    const deviceInfo = {
      type: userAgent.includes("Mobile") ? "Mobile" : "Desktop",
      browser: userAgent.includes("Chrome") ? "Chrome" : userAgent.includes("Firefox") ? "Firefox" : userAgent.includes("Safari") ? "Safari" : "Unknown",
      lastActive: new Date().toISOString(),
    };

    // For demo purposes, return current device
    // In production, you'd query a devices collection in the database
    res.status(200).json({
      success: true,
      data: {
        devices: [
          {
            id: "current",
            name: `${deviceInfo.type} - ${deviceInfo.browser}`,
            type: deviceInfo.type,
            browser: deviceInfo.browser,
            lastActive: deviceInfo.lastActive,
            current: true,
          },
        ],
      },
    });
  } catch (err: unknown) {
    console.error("Get devices error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
