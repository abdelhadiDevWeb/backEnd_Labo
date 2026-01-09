import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../entity/User";
import Papier from "../../entity/Papier";
import Attachment from "../../entity/Attachment";
import { registerSchema } from "../Client/validation";
import { AppConfig } from "../../config/app.config";
import { AuthRequest } from "../../middleware/auth.middleware";

// Register supplier function
export const registerSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input (same validation as client)
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      const errorMessages = error.details.map((detail) => {
        // Translate common validation messages to French
        const message = detail.message;
        if (message.includes("required")) {
          return `Le champ "${detail.context?.label || detail.path.join(".")}" est requis`;
        }
        if (message.includes("length")) {
          return `Le champ "${detail.context?.label || detail.path.join(".")}" a une longueur invalide`;
        }
        if (message.includes("email")) {
          return "Format d'email invalide";
        }
        return message;
      });
      
      res.status(400).json({
        success: false,
        message: errorMessages.length === 1 ? errorMessages[0] : `Erreurs de validation: ${errorMessages.join(", ")}`,
        errors: errorMessages,
      });
      return;
    }

    const { firstName, lastName, email, password, phone, address, role } = value;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    // Hash password with bcrypt
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user with supplier role (suppliers don't need laboType)
    const newUser = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
      role: "supplier",
      // laboType is not set for suppliers (optional)
      status: false, // Default status is false
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      AppConfig.JwtSecret,
      { expiresIn: "7d" }
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: "Supplier registered successfully",
      data: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        address: newUser.address,
        role: newUser.role,
        status: newUser.status,
      },
      token,
    });
  } catch (err: unknown) {
    console.error("Register supplier error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Upload supplier documents
export const uploadDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId; // From auth middleware
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.Tax_number || !files.identity || !files.commercial_register) {
      res.status(400).json({
        success: false,
        message: "All three documents are required: Tax_number, identity, commercial_register",
      });
      return;
    }

    const taxNumberFile = files.Tax_number[0];
    const identityFile = files.identity[0];
    const commercialRegisterFile = files.commercial_register[0];

    // Security: Validate file types (must be PDF)
    if (
      taxNumberFile.mimetype !== "application/pdf" ||
      identityFile.mimetype !== "application/pdf" ||
      commercialRegisterFile.mimetype !== "application/pdf"
    ) {
      res.status(400).json({
        success: false,
        message: "All files must be PDF format",
      });
      return;
    }

    // Security: Validate file sizes (max 5MB each)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (
      taxNumberFile.size > maxFileSize ||
      identityFile.size > maxFileSize ||
      commercialRegisterFile.size > maxFileSize
    ) {
      res.status(400).json({
        success: false,
        message: "Each file must not exceed 5MB",
      });
      return;
    }

    // Security: Validate file extensions
    const allowedExtensions = [".pdf"];
    const taxNumberExt = taxNumberFile.originalname.toLowerCase().substring(taxNumberFile.originalname.lastIndexOf("."));
    const identityExt = identityFile.originalname.toLowerCase().substring(identityFile.originalname.lastIndexOf("."));
    const commercialRegisterExt = commercialRegisterFile.originalname.toLowerCase().substring(commercialRegisterFile.originalname.lastIndexOf("."));

    if (
      !allowedExtensions.includes(taxNumberExt) ||
      !allowedExtensions.includes(identityExt) ||
      !allowedExtensions.includes(commercialRegisterExt)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid file extension. Only PDF files are allowed",
      });
      return;
    }

    // Check if user exists and is a supplier
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "supplier") {
      res.status(403).json({
        success: false,
        message: "Only suppliers can upload documents",
      });
      return;
    }

    // Check if documents already exist for this user
    const existingPapier = await Papier.findOne({ id_user: userId });
    if (existingPapier) {
      // Update existing documents
      existingPapier.type = "supplier";
      existingPapier.Tax_number = taxNumberFile.path;
      existingPapier.identity = identityFile.path;
      existingPapier.commercial_register = commercialRegisterFile.path;
      await existingPapier.save();

      res.status(200).json({
        success: true,
        message: "Documents updated successfully",
        data: {
          id: existingPapier._id,
          type: existingPapier.type,
          Tax_number: existingPapier.Tax_number,
          identity: existingPapier.identity,
          commercial_register: existingPapier.commercial_register,
        },
      });
    } else {
      // Create new document record
      const newPapier = new Papier({
        id_user: userId,
        type: "supplier",
        Tax_number: taxNumberFile.path,
        identity: identityFile.path,
        commercial_register: commercialRegisterFile.path,
      });

      await newPapier.save();

      res.status(201).json({
        success: true,
        message: "Documents uploaded successfully",
        data: {
          id: newPapier._id,
          type: newPapier.type,
          Tax_number: newPapier.Tax_number,
          identity: newPapier.identity,
          commercial_register: newPapier.commercial_register,
        },
      });
    }
  } catch (err: unknown) {
    console.error("Upload documents error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get supplier documents
export const getDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const userId = authReq.userId;

    const papier = await Papier.findOne({ id_user: userId });
    if (!papier) {
      res.status(404).json({
        success: false,
        message: "Documents not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: papier._id,
        Tax_number: papier.Tax_number,
        identity: papier.identity,
        commercial_register: papier.commercial_register,
      },
    });
  } catch (err: unknown) {
    console.error("Get documents error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update supplier profile (without password)
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { firstName, lastName, email, phone, address } = req.body;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Double-check role (already checked in middleware, but defense in depth)
    if (user.role !== "supplier") {
      res.status(403).json({
        success: false,
        message: "Only suppliers can update their profile",
      });
      return;
    }

    // Check if email is being changed and if it's already taken
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser && existingUser._id.toString() !== userId) {
        res.status(409).json({
          success: false,
          message: "Email already registered",
        });
        return;
      }
      user.email = email.toLowerCase();
    }

    // Update fields with length validation
    if (firstName !== undefined) {
      if (firstName.trim().length < 2 || firstName.trim().length > 50) {
        res.status(400).json({
          success: false,
          message: "First name must be between 2 and 50 characters",
        });
        return;
      }
      user.firstName = firstName.trim();
    }
    
    if (lastName !== undefined) {
      if (lastName.trim().length < 2 || lastName.trim().length > 50) {
        res.status(400).json({
          success: false,
          message: "Last name must be between 2 and 50 characters",
        });
        return;
      }
      user.lastName = lastName.trim();
    }
    
    if (phone !== undefined) {
      if (phone.trim().length < 10 || phone.trim().length > 15) {
        res.status(400).json({
          success: false,
          message: "Phone number must be between 10 and 15 characters",
        });
        return;
      }
      user.phone = phone.trim();
    }
    
    if (address !== undefined) {
      if (address.trim().length < 5 || address.trim().length > 200) {
        res.status(400).json({
          success: false,
          message: "Address must be between 5 and 200 characters",
        });
        return;
      }
      user.address = address.trim();
    }

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
        status: user.status,
      },
    });
  } catch (err: unknown) {
    console.error("Update profile error:", err);
    // Don't expose internal error details
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update supplier password
export const updatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
      return;
    }

    // Enhanced password validation
    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({
        success: false,
        message: "New password must be between 6 and 128 characters",
      });
      return;
    }

    // Prevent using current password as new password
    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
      return;
    }

    // Find user and explicitly select password field
    const user = await User.findById(userId).select("+password");
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "supplier") {
      res.status(403).json({
        success: false,
        message: "Only suppliers can update their password",
      });
      return;
    }

    // Validate that user has a password stored
    if (!user.password) {
      res.status(500).json({
        success: false,
        message: "User password not found in database",
      });
      return;
    }

    // Validate current password is not empty
    if (!currentPassword || currentPassword.trim() === "") {
      res.status(400).json({
        success: false,
        message: "Current password cannot be empty",
      });
      return;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword.trim(), user.password);
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

// Upload supplier profile image
export const uploadProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "Image file is required",
      });
      return;
    }

    // Validate file type
    if (!file.mimetype.startsWith("image/")) {
      res.status(400).json({
        success: false,
        message: "Only image files are allowed",
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
      res.status(400).json({
        success: false,
        message: "Image size must not exceed 5MB",
      });
      return;
    }

    // Check if user exists and is a supplier
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "supplier") {
      res.status(403).json({
        success: false,
        message: "Only suppliers can upload profile images",
      });
      return;
    }

    // Check if attachment already exists
    const existingAttachment = await Attachment.findOne({ id_user: userId });
    if (existingAttachment) {
      // Update existing attachment
      existingAttachment.image = file.path.replace(/\\/g, "/");
      await existingAttachment.save();

      res.status(200).json({
        success: true,
        message: "Profile image updated successfully",
        data: {
          id: existingAttachment._id,
          image: existingAttachment.image,
        },
      });
    } else {
      // Create new attachment
      const newAttachment = new Attachment({
        id_user: userId,
        image: file.path.replace(/\\/g, "/"),
      });

      await newAttachment.save();

      res.status(201).json({
        success: true,
        message: "Profile image uploaded successfully",
        data: {
          id: newAttachment._id,
          image: newAttachment.image,
        },
      });
    }
  } catch (err: unknown) {
    console.error("Upload profile image error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get supplier profile image
export const getProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const attachment = await Attachment.findOne({ id_user: userId });
    if (!attachment) {
      res.status(404).json({
        success: false,
        message: "Profile image not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: attachment._id,
        image: attachment.image,
      },
    });
  } catch (err: unknown) {
    console.error("Get profile image error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

