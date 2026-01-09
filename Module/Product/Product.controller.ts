import { Request, Response } from "express";
import Product from "../../entity/Product";
import { AuthRequest } from "../../middleware/auth.middleware";
import XLSX from "xlsx";
import User from "../../entity/User";

// Create a single product
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { name, purchasePrice, sellingPrice, quantity, category, deliveryTime, brand, productType } = req.body;

    // Get uploaded files
    const images = req.files && (req.files as any).images ? (req.files as any).images : [];
    const video = req.files && (req.files as any).video ? (req.files as any).video[0] : null;

    // Additional validation (middleware handles basic validation, but this is defense in depth)
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 200) {
      res.status(400).json({
        success: false,
        message: "Product name must be between 2 and 200 characters",
      });
      return;
    }

    const numPurchasePrice = parseFloat(purchasePrice);
    const numSellingPrice = parseFloat(sellingPrice);
    const numQuantity = parseInt(quantity);

    if (isNaN(numPurchasePrice) || numPurchasePrice < 0 || numPurchasePrice > 10000000) {
      res.status(400).json({
        success: false,
        message: "Purchase price must be a valid number between 0 and 10,000,000",
      });
      return;
    }

    if (isNaN(numSellingPrice) || numSellingPrice < 0 || numSellingPrice > 10000000) {
      res.status(400).json({
        success: false,
        message: "Selling price must be a valid number between 0 and 10,000,000",
      });
      return;
    }

    if (isNaN(numQuantity) || numQuantity < 0 || numQuantity > 1000000) {
      res.status(400).json({
        success: false,
        message: "Quantity must be a valid integer between 0 and 1,000,000",
      });
      return;
    }

    if (numSellingPrice < numPurchasePrice) {
      res.status(400).json({
        success: false,
        message: "Selling price must be greater than or equal to purchase price",
      });
      return;
    }

    if (!category || typeof category !== "string" || category.trim().length < 2 || category.trim().length > 100) {
      res.status(400).json({
        success: false,
        message: "Category must be between 2 and 100 characters",
      });
      return;
    }

    if (!deliveryTime || typeof deliveryTime !== "string" || deliveryTime.trim().length < 2 || deliveryTime.trim().length > 100) {
      res.status(400).json({
        success: false,
        message: "Delivery time must be between 2 and 100 characters",
      });
      return;
    }

    if (!brand || typeof brand !== "string" || brand.trim().length < 2 || brand.trim().length > 100) {
      res.status(400).json({
        success: false,
        message: "Brand must be between 2 and 100 characters",
      });
      return;
    }

    if (productType !== "Labo médical" && productType !== "labo d'ana pathologies") {
      res.status(400).json({
        success: false,
        message: "Product type must be either 'Labo médical' or 'labo d'ana pathologies'",
      });
      return;
    }

    // Process images
    const imagePaths: string[] = [];
    if (Array.isArray(images)) {
      images.forEach((file: Express.Multer.File) => {
        if (file.path) {
          imagePaths.push(file.path.replace(/\\/g, "/"));
        }
      });
    }

    // Process video
    let videoPath: string | undefined = undefined;
    if (video && video.path) {
      videoPath = video.path.replace(/\\/g, "/");
    }

    // Create new product with sanitized values
    const newProduct = new Product({
      name: name.trim().substring(0, 200), // Ensure max length
      purchasePrice: numPurchasePrice,
      sellingPrice: numSellingPrice,
      quantity: numQuantity,
      category: category.trim().substring(0, 100),
      deliveryTime: deliveryTime.trim().substring(0, 100),
      brand: brand.trim().substring(0, 100),
      productType: productType,
      images: imagePaths,
      video: videoPath,
      supplierId: userId, // Ensure this is the authenticated user's ID
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        id: newProduct._id,
        name: newProduct.name,
        purchasePrice: newProduct.purchasePrice,
        sellingPrice: newProduct.sellingPrice,
        quantity: newProduct.quantity,
        category: newProduct.category,
        deliveryTime: newProduct.deliveryTime,
        brand: newProduct.brand,
        productType: newProduct.productType,
        images: newProduct.images,
        video: newProduct.video,
        supplierId: newProduct.supplierId,
        createdAt: newProduct.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error("Create product error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Upload products from Excel file
export const uploadProductsFromExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "Excel file is required",
      });
      return;
    }

    // Validate file type
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
    ];

    if (!allowedMimeTypes.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls)$/i)) {
      res.status(400).json({
        success: false,
        message: "Invalid file type. Only Excel files (.xlsx, .xls) are allowed",
      });
      return;
    }

    // Read Excel file
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!Array.isArray(data) || data.length === 0) {
      res.status(400).json({
        success: false,
        message: "Excel file is empty or invalid",
      });
      return;
    }

    // Expected columns: name, purchasePrice, sellingPrice, quantity, category, deliveryTime, brand, productType
    const requiredColumns = ["name", "purchasePrice", "sellingPrice", "quantity", "category", "deliveryTime", "brand", "productType"];
    const firstRow = data[0] as any;
    const columns = Object.keys(firstRow);

    // Check if all required columns exist (case-insensitive)
    const columnMap: { [key: string]: string } = {};
    requiredColumns.forEach((reqCol) => {
      const foundCol = columns.find((col) => col.toLowerCase().trim() === reqCol.toLowerCase().trim());
      if (foundCol) {
        columnMap[reqCol] = foundCol;
      }
    });

    const missingColumns = requiredColumns.filter((col) => !columnMap[col]);
    if (missingColumns.length > 0) {
      res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingColumns.join(", ")}`,
        expectedColumns: requiredColumns,
      });
      return;
    }

    // Process and validate each row
    const products: any[] = [];
    const errors: string[] = [];

    data.forEach((row: any, index: number) => {
      const rowNum = index + 2; // +2 because index starts at 0 and Excel rows start at 2 (after header)

      try {
        const name = String(row[columnMap.name] || "").trim();
        const purchasePrice = parseFloat(row[columnMap.purchasePrice] || row[columnMap.price] || 0); // Support old "price" column
        const sellingPrice = parseFloat(row[columnMap.sellingPrice] || 0);
        const quantity = parseInt(row[columnMap.quantity]);
        const category = String(row[columnMap.category] || "").trim();
        const deliveryTime = String(row[columnMap.deliveryTime] || "").trim();
        const brand = String(row[columnMap.brand] || "").trim();
        const productType = String(row[columnMap.productType] || "").trim();

        // Validation
        if (!name || name.length < 2) {
          errors.push(`Row ${rowNum}: Product name is required and must be at least 2 characters`);
          return;
        }

        if (isNaN(purchasePrice) || purchasePrice < 0) {
          errors.push(`Row ${rowNum}: Invalid purchase price`);
          return;
        }

        if (isNaN(sellingPrice) || sellingPrice < 0) {
          errors.push(`Row ${rowNum}: Invalid selling price`);
          return;
        }

        if (sellingPrice < purchasePrice) {
          errors.push(`Row ${rowNum}: Selling price must be greater than or equal to purchase price`);
          return;
        }

        if (isNaN(quantity) || quantity < 0) {
          errors.push(`Row ${rowNum}: Invalid quantity`);
          return;
        }

        if (!category) {
          errors.push(`Row ${rowNum}: Category is required`);
          return;
        }

        if (!deliveryTime) {
          errors.push(`Row ${rowNum}: Delivery time is required`);
          return;
        }

        if (!brand) {
          errors.push(`Row ${rowNum}: Brand is required`);
          return;
        }

        if (productType !== "Labo médical" && productType !== "labo d'ana pathologies") {
          errors.push(`Row ${rowNum}: Product type must be 'Labo médical' or 'labo d'ana pathologies'`);
          return;
        }

        products.push({
          name,
          purchasePrice,
          sellingPrice,
          quantity,
          category,
          deliveryTime,
          brand,
          productType,
          images: [],
          video: undefined,
          supplierId: userId,
        });
      } catch (error) {
        errors.push(`Row ${rowNum}: Error processing row - ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    });

    if (errors.length > 0 && products.length === 0) {
      res.status(400).json({
        success: false,
        message: "All rows have errors",
        errors,
      });
      return;
    }

    // Insert products into database
    if (products.length > 0) {
      const insertedProducts = await Product.insertMany(products);

      res.status(201).json({
        success: true,
        message: `Successfully imported ${insertedProducts.length} product(s)`,
        data: {
          imported: insertedProducts.length,
          total: data.length,
          errors: errors.length,
          products: insertedProducts.map((p) => ({
            id: p._id,
            name: p.name,
            purchasePrice: p.purchasePrice,
            sellingPrice: p.sellingPrice,
            quantity: p.quantity,
            category: p.category,
            deliveryTime: p.deliveryTime,
            brand: p.brand,
            productType: p.productType,
            images: p.images,
            video: p.video,
          })),
        },
        ...(errors.length > 0 && { errorDetails: errors }),
      });
    } else {
      res.status(400).json({
        success: false,
        message: "No valid products to import",
        errors,
      });
    }
  } catch (err: unknown) {
    console.error("Upload products from Excel error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all products for a supplier
export const getSupplierProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const products = await Product.find({ supplierId: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        products: products.map((p) => ({
          id: p._id,
          name: p.name,
          purchasePrice: p.purchasePrice,
          sellingPrice: p.sellingPrice,
          quantity: p.quantity,
          category: p.category,
          deliveryTime: p.deliveryTime,
          brand: p.brand,
          productType: p.productType,
          images: p.images,
          video: p.video,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        total: products.length,
      },
    });
  } catch (err: unknown) {
    console.error("Get supplier products error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all products (public - for clients)
export const getAllProducts = async (req: Request & { userRole?: string; userLaboType?: string }, res: Response): Promise<void> => {
  try {
    // Build query - filter by laboType if user is a client
    let query: any = {};
    
    // If user is authenticated and is a client, filter by their laboType
    if (req.userRole === "client" && req.userLaboType) {
      query.productType = req.userLaboType;
    }
    
    // Get all products (including out of stock, but prioritize in-stock)
    const products = await Product.find(query)
      .populate("supplierId", "firstName lastName email phone address")
      .sort({ quantity: -1, createdAt: -1 }); // Sort by quantity (in stock first), then by date

    console.log(`Found ${products.length} products in database${req.userRole === "client" && req.userLaboType ? ` (filtered by laboType: ${req.userLaboType})` : ""}`); // Debug log

    res.status(200).json({
      success: true,
      data: {
        products: products.map((p: any) => ({
          id: p._id.toString(),
          name: p.name,
          price: p.sellingPrice, // Show selling price to clients
          quantity: p.quantity,
          category: p.category,
          deliveryTime: p.deliveryTime,
          brand: p.brand,
          productType: p.productType,
          images: p.images || [],
          video: p.video || null,
          supplier: p.supplierId
            ? {
                id: p.supplierId._id.toString(),
                name: `${p.supplierId.firstName} ${p.supplierId.lastName}`,
                email: p.supplierId.email,
                phone: p.supplierId.phone,
                address: p.supplierId.address,
              }
            : null,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        total: products.length,
      },
    });
  } catch (err: unknown) {
    console.error("Get all products error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get single product by ID (public - for clients)
export const getProductById = async (req: Request & { userRole?: string; userLaboType?: string }, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate("supplierId", "firstName lastName email phone address");

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // If user is authenticated and is a client, check if product matches their laboType
    if (req.userRole === "client" && req.userLaboType) {
      if (product.productType !== req.userLaboType) {
        res.status(403).json({
          success: false,
          message: "Ce produit n'est pas disponible pour votre type de laboratoire",
        });
        return;
      }
    }

    if (product.quantity === 0) {
      res.status(404).json({
        success: false,
        message: "Product is out of stock",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: product._id,
        name: product.name,
        price: product.sellingPrice, // Show selling price to clients
        quantity: product.quantity,
        category: product.category,
        deliveryTime: product.deliveryTime,
        brand: product.brand,
        productType: product.productType,
        images: product.images,
        video: product.video,
        supplier: (product as any).supplierId
          ? {
              id: (product as any).supplierId._id,
              name: `${(product as any).supplierId.firstName} ${(product as any).supplierId.lastName}`,
              email: (product as any).supplierId.email,
              phone: (product as any).supplierId.phone,
              address: (product as any).supplierId.address,
            }
          : null,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Get product by ID error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update a product (supplier only)
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { id } = req.params;
    const { name, purchasePrice, sellingPrice, quantity, category, deliveryTime, brand, productType } = req.body;

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // Verify the product belongs to the authenticated supplier
    if (product.supplierId.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only update your own products",
      });
      return;
    }

    // Get uploaded files
    const images = req.files && (req.files as any).images ? (req.files as any).images : [];
    const video = req.files && (req.files as any).video ? (req.files as any).video[0] : null;

    // Validate and update fields
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 200) {
        res.status(400).json({
          success: false,
          message: "Product name must be between 2 and 200 characters",
        });
        return;
      }
      product.name = name.trim().substring(0, 200);
    }

    if (purchasePrice !== undefined) {
      const numPurchasePrice = parseFloat(purchasePrice);
      if (isNaN(numPurchasePrice) || numPurchasePrice < 0 || numPurchasePrice > 10000000) {
        res.status(400).json({
          success: false,
          message: "Purchase price must be a valid number between 0 and 10,000,000",
        });
        return;
      }
      product.purchasePrice = numPurchasePrice;
    }

    if (sellingPrice !== undefined) {
      const numSellingPrice = parseFloat(sellingPrice);
      if (isNaN(numSellingPrice) || numSellingPrice < 0 || numSellingPrice > 10000000) {
        res.status(400).json({
          success: false,
          message: "Selling price must be a valid number between 0 and 10,000,000",
        });
        return;
      }
      product.sellingPrice = numSellingPrice;
    }

    // Validate selling price >= purchase price
    if (product.sellingPrice < product.purchasePrice) {
      res.status(400).json({
        success: false,
        message: "Selling price must be greater than or equal to purchase price",
      });
      return;
    }

    if (quantity !== undefined) {
      const numQuantity = parseInt(quantity);
      if (isNaN(numQuantity) || numQuantity < 0 || numQuantity > 1000000) {
        res.status(400).json({
          success: false,
          message: "Quantity must be a valid integer between 0 and 1,000,000",
        });
        return;
      }
      product.quantity = numQuantity;
    }

    if (category !== undefined) {
      if (typeof category !== "string" || category.trim().length < 2 || category.trim().length > 100) {
        res.status(400).json({
          success: false,
          message: "Category must be between 2 and 100 characters",
        });
        return;
      }
      product.category = category.trim().substring(0, 100);
    }

    if (deliveryTime !== undefined) {
      if (typeof deliveryTime !== "string" || deliveryTime.trim().length < 2 || deliveryTime.trim().length > 100) {
        res.status(400).json({
          success: false,
          message: "Delivery time must be between 2 and 100 characters",
        });
        return;
      }
      product.deliveryTime = deliveryTime.trim().substring(0, 100);
    }

    if (brand !== undefined) {
      if (typeof brand !== "string" || brand.trim().length < 2 || brand.trim().length > 100) {
        res.status(400).json({
          success: false,
          message: "Brand must be between 2 and 100 characters",
        });
        return;
      }
      product.brand = brand.trim().substring(0, 100);
    }

    if (productType !== undefined) {
      if (productType !== "Labo médical" && productType !== "labo d'ana pathologies") {
        res.status(400).json({
          success: false,
          message: "Product type must be either 'Labo médical' or 'labo d'ana pathologies'",
        });
        return;
      }
      product.productType = productType;
    }

    // Process new images (if provided)
    if (Array.isArray(images) && images.length > 0) {
      const imagePaths: string[] = [];
      images.forEach((file: Express.Multer.File) => {
        if (file.path) {
          imagePaths.push(file.path.replace(/\\/g, "/"));
        }
      });
      // Replace existing images with new ones
      product.images = imagePaths;
    }

    // Process new video (if provided)
    if (video && video.path) {
      product.video = video.path.replace(/\\/g, "/");
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: {
        id: product._id,
        name: product.name,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        quantity: product.quantity,
        category: product.category,
        deliveryTime: product.deliveryTime,
        brand: product.brand,
        productType: product.productType,
        images: product.images,
        video: product.video,
        supplierId: product.supplierId,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Update product error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete a product (supplier only)
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { id } = req.params;

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    // Verify the product belongs to the authenticated supplier
    if (product.supplierId.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only delete your own products",
      });
      return;
    }

    // Delete the product
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err: unknown) {
    console.error("Delete product error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

