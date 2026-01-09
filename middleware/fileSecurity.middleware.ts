import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs/promises";

// Dangerous file extensions that should never be allowed
const DANGEROUS_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".com", ".pif", ".scr", ".vbs", ".js", ".jar",
  ".sh", ".php", ".asp", ".aspx", ".jsp", ".py", ".rb", ".pl", ".cgi"
];

// Allowed image extensions
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

// Allowed video extensions
const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".wmv", ".flv", ".webm"];

// Allowed document extensions
const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf"];

// Allowed Excel extensions
const ALLOWED_EXCEL_EXTENSIONS = [".xlsx", ".xls", ".xlsm"];

// Check if file extension is dangerous
export const isDangerousExtension = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.includes(ext);
};

// Check if file extension is in allowed list
export const isAllowedExtension = (
  filename: string,
  allowedExtensions: string[]
): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
};

// Sanitize filename to prevent path traversal and other attacks
export const sanitizeFilename = (filename: string): string => {
  // Remove path traversal attempts
  let sanitized = filename
    .replace(/\.\./g, "") // Remove ..
    .replace(/[\/\\]/g, "_") // Replace slashes with underscores
    .replace(/[^a-zA-Z0-9._-]/g, "_"); // Remove special characters except . _ -

  // Limit filename length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
};

// Validate file path to prevent directory traversal
export const validateFilePath = (filePath: string, allowedDir: string): boolean => {
  try {
    const resolvedPath = path.resolve(filePath);
    const resolvedAllowedDir = path.resolve(allowedDir);
    
    // Check if the resolved path is within the allowed directory
    return resolvedPath.startsWith(resolvedAllowedDir);
  } catch (error) {
    return false;
  }
};

// Middleware to validate uploaded files
export const validateUploadedFiles = (
  allowedExtensions: string[],
  maxFiles: number = 10
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[] | undefined;

      if (!files) {
        next();
        return;
      }

      // Handle single file
      if (Array.isArray(files)) {
        if (files.length > maxFiles) {
          res.status(400).json({
            success: false,
            message: `Maximum ${maxFiles} files allowed`,
          });
          return;
        }

        for (const file of files) {
          if (isDangerousExtension(file.originalname)) {
            res.status(400).json({
              success: false,
              message: "Dangerous file type detected",
            });
            return;
          }

          if (!isAllowedExtension(file.originalname, allowedExtensions)) {
            res.status(400).json({
              success: false,
              message: `Only ${allowedExtensions.join(", ")} files are allowed`,
            });
            return;
          }

          // Validate file path
          if (file.path && !validateFilePath(file.path, process.cwd())) {
            res.status(400).json({
              success: false,
              message: "Invalid file path",
            });
            return;
          }
        }
      } else if (typeof files === "object") {
        // Handle multiple fields
        for (const fieldName in files) {
          const fieldFiles = files[fieldName];
          if (Array.isArray(fieldFiles)) {
            if (fieldFiles.length > maxFiles) {
              res.status(400).json({
                success: false,
                message: `Maximum ${maxFiles} files allowed for ${fieldName}`,
              });
              return;
            }

            for (const file of fieldFiles) {
              if (isDangerousExtension(file.originalname)) {
                res.status(400).json({
                  success: false,
                  message: "Dangerous file type detected",
                });
                return;
              }

              if (!isAllowedExtension(file.originalname, allowedExtensions)) {
                res.status(400).json({
                  success: false,
                  message: `Only ${allowedExtensions.join(", ")} files are allowed`,
                });
                return;
              }

              // Validate file path
              if (file.path && !validateFilePath(file.path, process.cwd())) {
                res.status(400).json({
                  success: false,
                  message: "Invalid file path",
                });
                return;
              }
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error("File validation error:", error);
      res.status(500).json({
        success: false,
        message: "File validation error",
      });
    }
  };
};

// Export allowed extensions for use in routes
export {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_EXCEL_EXTENSIONS,
};

