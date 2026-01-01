import Joi from "joi";

// Register validation schema
export const registerSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required()
    .messages({
      "string.empty": "First name is required",
      "string.min": "First name must be at least 2 characters",
      "string.max": "First name cannot exceed 50 characters",
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required()
    .messages({
      "string.empty": "Last name is required",
      "string.min": "Last name must be at least 2 characters",
      "string.max": "Last name cannot exceed 50 characters",
    }),
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    }),
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Please provide a valid phone number",
    }),
  address: Joi.string()
    .min(5)
    .max(200)
    .trim()
    .required()
    .messages({
      "string.empty": "Address is required",
      "string.min": "Address must be at least 5 characters",
      "string.max": "Address cannot exceed 200 characters",
    }),
  role: Joi.string()
    .valid("client", "supplier", "admin")
    .default("client")
    .messages({
      "any.only": "Role must be one of: client, supplier, admin",
    }),
});

// Login validation schema
export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please provide a valid email address",
    }),
  password: Joi.string()
    .required()
    .messages({
      "string.empty": "Password is required",
    }),
});

