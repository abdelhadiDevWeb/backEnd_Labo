import { Request, Response } from "express";
import mongoose from "mongoose";
import Commande from "../../entity/Commande";
import { AuthRequest } from "../../middleware/auth.middleware";
import Product from "../../entity/Product";
import User from "../../entity/User";
import Notification from "../../entity/Notification";

// Socket.io instance (will be set from index.ts)
let io: any = null;
export const setSocketIO = (socketIO: any) => {
  io = socketIO;
};

// Create a new order
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      res.status(400).json({
        success: false,
        message: "Products array is required and must not be empty",
      });
      return;
    }

    // Verify user is a client
    const user = await User.findById(userId);
    if (!user || user.role !== "client") {
      res.status(403).json({
        success: false,
        message: "Only clients can create orders",
      });
      return;
    }

    // Validate and process products
    let total = 0;
    const processedProducts: Array<{
      productId: mongoose.Types.ObjectId;
      name: string;
      price: number;
      quantity: number;
    }> = [];
    const supplierIds = new Set<string>();

    for (const item of products) {
      if (!item.id || !item.quantity || item.quantity < 1) {
        res.status(400).json({
          success: false,
          message: "Invalid product data",
        });
        return;
      }

      // Get product from database
      const product = await Product.findById(item.id);
      if (!product) {
        res.status(404).json({
          success: false,
          message: `Product ${item.id} not found`,
        });
        return;
      }

      // Check if product has enough quantity
      if (product.quantity < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient quantity for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`,
        });
        return;
      }

      // Get supplier ID
      if (product.supplierId) {
        supplierIds.add(product.supplierId.toString());
      }

      const itemPrice = product.sellingPrice * item.quantity;
      total += itemPrice;

      processedProducts.push({
        productId: product._id,
        name: product.name,
        price: product.sellingPrice,
        quantity: item.quantity,
      });
    }

    // Check if all products belong to the same supplier
    if (supplierIds.size > 1) {
      res.status(400).json({
        success: false,
        message: "All products must be from the same supplier",
      });
      return;
    }

    if (supplierIds.size === 0) {
      res.status(400).json({
        success: false,
        message: "No supplier found for the products",
      });
      return;
    }

    const supplierId = Array.from(supplierIds)[0];

    // Create order
    const newOrder = new Commande({
      total,
      products: processedProducts,
      idBuyer: userId,
      idSupplier: supplierId,
      status: "en cours",
    });

    await newOrder.save();

    // Update product quantities
    for (const item of products) {
      await Product.findByIdAndUpdate(item.id, {
        $inc: { quantity: -item.quantity },
      });
    }

    // Populate order for response
    const populatedOrder = await Commande.findById(newOrder._id)
      .populate("idBuyer", "firstName lastName email")
      .populate("idSupplier", "firstName lastName email");

    // Send Socket.io notification to supplier
    if (io) {
      io.to(`supplier_${supplierId}`).emit("newOrder", {
        orderId: newOrder._id.toString(),
        total: total,
        buyerName: `${user.firstName} ${user.lastName}`,
        productsCount: processedProducts.length,
        createdAt: newOrder.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: populatedOrder,
      orderId: newOrder._id.toString(),
      supplierId: supplierId,
    });
  } catch (err: unknown) {
    console.error("Create order error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get orders for a client
export const getClientOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const orders = await Commande.find({ idBuyer: userId })
      .populate("idSupplier", "firstName lastName email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        orders,
      },
    });
  } catch (err: unknown) {
    console.error("Get client orders error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get orders for a supplier
export const getSupplierOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const orders = await Commande.find({ idSupplier: userId })
      .populate("idBuyer", "firstName lastName email phone")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        orders,
      },
    });
  } catch (err: unknown) {
    console.error("Get supplier orders error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update order status
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { orderId } = req.params;
    const { status } = req.body;

    if (!status || !["en cours", "on route", "arrived"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'en cours', 'on route', or 'arrived'",
      });
      return;
    }

    const order = await Commande.findById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    // Verify user is the supplier for this order
    if (order.idSupplier.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "Only the supplier can update order status",
      });
      return;
    }

    // Validate status transition
    const currentStatus = order.status;
    if (currentStatus === "en cours" && status !== "on route") {
      res.status(400).json({
        success: false,
        message: "Order status can only be changed from 'en cours' to 'on route'",
      });
      return;
    }
    if (currentStatus === "on route" && status !== "arrived") {
      res.status(400).json({
        success: false,
        message: "Order status can only be changed from 'on route' to 'arrived'",
      });
      return;
    }
    if (currentStatus === "arrived") {
      res.status(400).json({
        success: false,
        message: "Order has already arrived and cannot be changed",
      });
      return;
    }

    const oldStatus = order.status;
    order.status = status as "en cours" | "on route" | "arrived";
    await order.save();

    // Create notification for the buyer
    const statusMessages: { [key: string]: string } = {
      "on route": "Votre commande est en route",
      "arrived": "Votre commande est arrivée",
    };

    const message = statusMessages[status] || `Le statut de votre commande a été mis à jour: ${status}`;

    const notification = new Notification({
      idSender: userId,
      idReceiver: order.idBuyer,
      type: "order_status",
      message: message,
      isRead: false,
    });

    await notification.save();

    // Send Socket.io notification to client
    if (io) {
      io.to(`client_${order.idBuyer.toString()}`).emit("orderStatusUpdate", {
        orderId: order._id.toString(),
        status: status,
        message: message,
        notificationId: notification._id.toString(),
      });
    }

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (err: unknown) {
    console.error("Update order status error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

