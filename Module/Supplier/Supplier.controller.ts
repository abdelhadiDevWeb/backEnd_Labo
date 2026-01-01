import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../entity/User";
import Papier from "../../entity/Papier";
import { registerSchema } from "../Client/validation";
import { AppConfig } from "../../config/app.config";

// Register supplier function
export const registerSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input (same validation as client)
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
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

    // Create new user with supplier role
    const newUser = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
      role: "supplier",
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

    // Check if PDF files
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
      existingPapier.Tax_number = taxNumberFile.path;
      existingPapier.identity = identityFile.path;
      existingPapier.commercial_register = commercialRegisterFile.path;
      await existingPapier.save();

      res.status(200).json({
        success: true,
        message: "Documents updated successfully",
        data: {
          id: existingPapier._id,
          Tax_number: existingPapier.Tax_number,
          identity: existingPapier.identity,
          commercial_register: existingPapier.commercial_register,
        },
      });
    } else {
      // Create new document record
      const newPapier = new Papier({
        id_user: userId,
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

