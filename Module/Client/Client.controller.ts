import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../entity/User";
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

    const { firstName, lastName, email, password, phone, address, role, laboType } = value;

    // Validate laboType for clients
    if (role === "client" && !laboType) {
      res.status(400).json({
        success: false,
        message: "Le type de laboratoire est requis pour les clients",
      });
      return;
    }

    if (role === "client" && laboType !== "Labo médical" && laboType !== "labo d'ana pathologies") {
      res.status(400).json({
        success: false,
        message: "Le type de laboratoire doit être 'Labo médical' ou 'labo d'ana pathologies'",
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    // Hash password with bcrypt (salt rounds: 12 for high security)
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
      role: role || "client",
      status: false, // Default status is false, needs admin approval
      laboType: role === "client" ? laboType : undefined, // Only set for clients
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      AppConfig.JwtSecret,
      { expiresIn: "7d" }
    );

    // Return success response (don't send password)
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        address: newUser.address,
        role: newUser.role,
        laboType: newUser.laboType,
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

    // Find user by email and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // Generate JWT token (include laboType for clients)
    const tokenPayload: any = {
      id: user._id,
      email: user.email,
      role: user.role,
    };
    
    // Include laboType if user is a client
    if (user.role === "client" && user.laboType) {
      tokenPayload.laboType = user.laboType;
    }
    
    const token = jwt.sign(tokenPayload, AppConfig.JwtSecret, { expiresIn: "7d" });

    // Return success response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        status: user.status,
        laboType: user.laboType,
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
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Update fields
    user.firstName = firstName;
    user.lastName = lastName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        updatedAt: user.updatedAt,
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

    // Find user with password field
    const user = await User.findById(req.userId).select("+password");
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
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
    user.password = hashedPassword;
    await user.save();

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

// Get current user role
export const getUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("role email");
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    console.error("Get user role error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Upload client documents (identity only)
export const uploadClientDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Security: Ensure only identity field is uploaded (reject other fields)
    if (!files || !files.identity) {
      res.status(400).json({
        success: false,
        message: "Identity document is required",
      });
      return;
    }

    // Security: Check if any other fields besides identity were uploaded
    const allowedFields = ["identity"];
    const uploadedFields = Object.keys(files);
    const unauthorizedFields = uploadedFields.filter(field => !allowedFields.includes(field));
    
    if (unauthorizedFields.length > 0) {
      res.status(400).json({
        success: false,
        message: `Clients can only upload identity document. Unauthorized fields: ${unauthorizedFields.join(", ")}`,
      });
      return;
    }

    const identityFile = files.identity[0];

    // Security: Validate file type (must be PDF)
    if (identityFile.mimetype !== "application/pdf") {
      res.status(400).json({
        success: false,
        message: "Identity file must be PDF format",
      });
      return;
    }

    // Security: Validate file size (max 5MB)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (identityFile.size > maxFileSize) {
      res.status(400).json({
        success: false,
        message: "File size must not exceed 5MB",
      });
      return;
    }

    // Security: Validate file extension
    const allowedExtensions = [".pdf"];
    const fileExt = identityFile.originalname.toLowerCase().substring(identityFile.originalname.lastIndexOf("."));
    if (!allowedExtensions.includes(fileExt)) {
      res.status(400).json({
        success: false,
        message: "Invalid file extension. Only PDF files are allowed",
      });
      return;
    }

    // Check if user exists and is a client
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "client") {
      res.status(403).json({
        success: false,
        message: "Only clients can upload identity document",
      });
      return;
    }

    // Import Papier model
    const Papier = (await import("../../entity/Papier")).default;

    // Check if documents already exist for this user
    const existingPapier = await Papier.findOne({ id_user: userId });
    if (existingPapier) {
      // Update existing document
      existingPapier.type = "client";
      existingPapier.identity = identityFile.path;
      await existingPapier.save();

      res.status(200).json({
        success: true,
        message: "Document updated successfully",
        data: {
          id: existingPapier._id,
          type: existingPapier.type,
          identity: existingPapier.identity,
        },
      });
    } else {
      // Create new document record
      const newPapier = new Papier({
        id_user: userId,
        type: "client",
        identity: identityFile.path,
      });

      await newPapier.save();

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: {
          id: newPapier._id,
          type: newPapier.type,
          identity: newPapier.identity,
        },
      });
    }
  } catch (err: unknown) {
    console.error("Upload client documents error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
