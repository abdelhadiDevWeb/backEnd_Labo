import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

// Sanitize string input to prevent XSS and injection attacks
export const sanitizeInput = (input: string): string => {
  if (typeof input !== "string") return "";
  
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, ""); // Remove event handlers
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Algerian format)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(\+213|0)[5-7][0-9]{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
};

// Validate product name
export const isValidProductName = (name: string): boolean => {
  if (!name || name.length < 2 || name.length > 200) return false;
  // Allow alphanumeric, spaces, and common punctuation
  const nameRegex = /^[a-zA-Z0-9\s\-_.,()àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+$/;
  return nameRegex.test(name);
};

// Validate price (must be positive number)
export const isValidPrice = (price: any): boolean => {
  const numPrice = parseFloat(price);
  return !isNaN(numPrice) && numPrice >= 0 && numPrice <= 10000000; // Max 10 million
};

// Validate quantity (must be non-negative integer)
export const isValidQuantity = (quantity: any): boolean => {
  const numQuantity = parseInt(quantity);
  return !isNaN(numQuantity) && numQuantity >= 0 && numQuantity <= 1000000; // Max 1 million
};

// Middleware to sanitize request body
export const sanitizeBody = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    });
  }
  next();
};

// Validate update profile request
export const validateUpdateProfile = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const { firstName, lastName, email, phone, address } = req.body;
  const errors: string[] = [];

  if (firstName !== undefined) {
    if (typeof firstName !== "string") {
      errors.push("Le prénom doit être une chaîne de caractères");
    } else if (firstName.trim().length < 2) {
      errors.push("Le prénom doit contenir au moins 2 caractères");
    } else if (firstName.trim().length > 50) {
      errors.push("Le prénom ne peut pas dépasser 50 caractères");
    }
  }

  if (lastName !== undefined) {
    if (typeof lastName !== "string") {
      errors.push("Le nom doit être une chaîne de caractères");
    } else if (lastName.trim().length < 2) {
      errors.push("Le nom doit contenir au moins 2 caractères");
    } else if (lastName.trim().length > 50) {
      errors.push("Le nom ne peut pas dépasser 50 caractères");
    }
  }

  if (email !== undefined) {
    if (typeof email !== "string") {
      errors.push("L'email doit être une chaîne de caractères");
    } else if (!isValidEmail(email)) {
      errors.push("Format d'email invalide. Exemple: exemple@domaine.com");
    }
  }

  if (phone !== undefined) {
    if (typeof phone !== "string") {
      errors.push("Le numéro de téléphone doit être une chaîne de caractères");
    } else if (!isValidPhone(phone)) {
      errors.push("Format de numéro de téléphone invalide. Format algérien requis: 0X XX XX XX XX ou +213 X XX XX XX XX");
    }
  }

  if (address !== undefined) {
    if (typeof address !== "string") {
      errors.push("L'adresse doit être une chaîne de caractères");
    } else if (address.trim().length < 5) {
      errors.push("L'adresse doit contenir au moins 5 caractères");
    } else if (address.trim().length > 200) {
      errors.push("L'adresse ne peut pas dépasser 200 caractères");
    }
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: errors.length === 1 ? errors[0] : `Erreurs de validation: ${errors.join(", ")}`,
      errors,
    });
    return;
  }

  next();
};

// Validate update password request
export const validateUpdatePassword = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const { currentPassword, newPassword } = req.body;
  const errors: string[] = [];

  if (!currentPassword) {
    errors.push("Le mot de passe actuel est requis");
  } else if (typeof currentPassword !== "string") {
    errors.push("Le mot de passe actuel doit être une chaîne de caractères");
  } else if (currentPassword.length < 6) {
    errors.push("Le mot de passe actuel doit contenir au moins 6 caractères");
  }

  if (!newPassword) {
    errors.push("Le nouveau mot de passe est requis");
  } else if (typeof newPassword !== "string") {
    errors.push("Le nouveau mot de passe doit être une chaîne de caractères");
  } else if (newPassword.length < 6) {
    errors.push("Le nouveau mot de passe doit contenir au moins 6 caractères");
  } else if (newPassword.length > 128) {
    errors.push("Le nouveau mot de passe ne peut pas dépasser 128 caractères");
  }

  // Check for common weak passwords
  const weakPasswords = ["password", "123456", "qwerty", "abc123"];
  if (newPassword && weakPasswords.includes(newPassword.toLowerCase())) {
    errors.push("Le mot de passe est trop faible. Veuillez choisir un mot de passe plus fort");
  }

  // Check if passwords are the same
  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push("Le nouveau mot de passe doit être différent du mot de passe actuel");
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: errors.length === 1 ? errors[0] : `Erreurs de validation: ${errors.join(", ")}`,
      errors,
    });
    return;
  }

  next();
};

// Validate create product request
export const validateCreateProduct = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Handle both JSON and FormData (after multer parsing)
  const { name, purchasePrice, sellingPrice, quantity, category, deliveryTime, brand, productType } = req.body || {};
  const errors: string[] = [];

  if (!name) {
    errors.push("Le nom du produit est requis");
  } else if (!isValidProductName(name)) {
    errors.push("Le nom du produit doit contenir entre 2 et 200 caractères");
  }

  if (purchasePrice === undefined || purchasePrice === null || purchasePrice === "") {
    errors.push("Le prix d'achat est requis");
  } else if (!isValidPrice(purchasePrice)) {
    errors.push("Le prix d'achat doit être un nombre positif valide (max 10,000,000 DA)");
  }

  if (sellingPrice === undefined || sellingPrice === null || sellingPrice === "") {
    errors.push("Le prix de vente est requis");
  } else if (!isValidPrice(sellingPrice)) {
    errors.push("Le prix de vente doit être un nombre positif valide (max 10,000,000 DA)");
  }

  if (purchasePrice && sellingPrice && parseFloat(sellingPrice) < parseFloat(purchasePrice)) {
    errors.push("Le prix de vente doit être supérieur ou égal au prix d'achat");
  }

  if (quantity === undefined || quantity === null || quantity === "") {
    errors.push("La quantité est requise");
  } else if (!isValidQuantity(quantity)) {
    errors.push("La quantité doit être un entier positif valide (max 1,000,000)");
  }

  if (!category || (typeof category === "string" && category.trim() === "")) {
    errors.push("La catégorie est requise");
  } else if (typeof category !== "string") {
    errors.push("La catégorie doit être une chaîne de caractères");
  } else if (category.trim().length < 2) {
    errors.push("La catégorie doit contenir au moins 2 caractères");
  } else if (category.trim().length > 100) {
    errors.push("La catégorie ne peut pas dépasser 100 caractères");
  }

  if (!deliveryTime || (typeof deliveryTime === "string" && deliveryTime.trim() === "")) {
    errors.push("Le délai de livraison est requis");
  } else if (typeof deliveryTime !== "string") {
    errors.push("Le délai de livraison doit être une chaîne de caractères");
  } else if (deliveryTime.trim().length < 2) {
    errors.push("Le délai de livraison doit contenir au moins 2 caractères");
  } else if (deliveryTime.trim().length > 100) {
    errors.push("Le délai de livraison ne peut pas dépasser 100 caractères");
  }

  if (!brand || (typeof brand === "string" && brand.trim() === "")) {
    errors.push("La marque est requise");
  } else if (typeof brand !== "string") {
    errors.push("La marque doit être une chaîne de caractères");
  } else if (brand.trim().length < 2) {
    errors.push("La marque doit contenir au moins 2 caractères");
  } else if (brand.trim().length > 100) {
    errors.push("La marque ne peut pas dépasser 100 caractères");
  }

  if (!productType || (typeof productType === "string" && productType.trim() === "")) {
    errors.push("Le type de produit est requis");
  } else if (productType !== "Labo médical" && productType !== "labo d'ana pathologies") {
    errors.push("Le type de produit doit être soit 'Labo médical' soit 'labo d'ana pathologies'");
  }

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: errors.length === 1 ? errors[0] : `Erreurs de validation: ${errors.join(", ")}`,
      errors,
    });
    return;
  }

  next();
};

