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

    // Check if we have at least one supplier
    if (supplierIds.size === 0) {
      res.status(400).json({
        success: false,
        message: "No supplier found for the products",
      });
      return;
    }

    // If multiple suppliers, we'll create separate orders for each
    // But for now, we'll create one order with the first supplier
    // The frontend should group products by supplier and send separate requests
    // This maintains backward compatibility
    if (supplierIds.size > 1) {
      res.status(400).json({
        success: false,
        message: "All products must be from the same supplier. Please group products by supplier and create separate orders.",
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

    // Create notification in database for the supplier
    const notificationMessage = `Nouvelle commande de ${user.firstName} ${user.lastName} - ${processedProducts.length} produit(s) - Total: ${total.toFixed(2)} DA`;
    const notification = new Notification({
      idSender: userId,
      idReceiver: supplierId,
      type: "new_order",
      message: notificationMessage,
      isRead: false,
    });

    await notification.save();

    // Send Socket.io notification to supplier
    if (io) {
      io.to(`supplier_${supplierId}`).emit("newOrder", {
        orderId: newOrder._id.toString(),
        total: total,
        buyerName: `${user.firstName} ${user.lastName}`,
        productsCount: processedProducts.length,
        createdAt: newOrder.createdAt,
        notificationId: notification._id.toString(),
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

// Get detailed supplier statistics for statistics page
export const getSupplierDetailedStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Get all orders for this supplier
    const orders = await Commande.find({ idSupplier: userId })
      .populate("idBuyer", "firstName lastName email")
      .populate("idSupplier", "firstName lastName email")
      .sort({ createdAt: -1 });

    // Calculate revenue over time (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
    const monthlyRevenue: { [key: string]: number } = {};
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[monthKey] = 0;
    }

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (orderDate >= sixMonthsAgo) {
        const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyRevenue[monthKey] !== undefined) {
          monthlyRevenue[monthKey] += order.total;
        }
      }
    });

    // Best selling products (by quantity sold)
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number; orders: number } } = {};
    
    orders.forEach(order => {
      order.products.forEach(product => {
        if (!productSales[product.productId.toString()]) {
          productSales[product.productId.toString()] = {
            name: product.name,
            quantity: 0,
            revenue: 0,
            orders: 0,
          };
        }
        productSales[product.productId.toString()].quantity += product.quantity;
        productSales[product.productId.toString()].revenue += product.price * product.quantity;
        productSales[product.productId.toString()].orders += 1;
      });
    });

    const bestProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Top customers (by total spent)
    const customerStats: { [key: string]: { 
      buyer: any; 
      totalSpent: number; 
      ordersCount: number; 
      productsCount: number;
    } } = {};

    orders.forEach(order => {
      if (!order.idBuyer) return;
      const buyerId = order.idBuyer.toString();
      if (!customerStats[buyerId]) {
        customerStats[buyerId] = {
          buyer: order.idBuyer,
          totalSpent: 0,
          ordersCount: 0,
          productsCount: 0,
        };
      }
      customerStats[buyerId].totalSpent += order.total;
      customerStats[buyerId].ordersCount += 1;
      customerStats[buyerId].productsCount += order.products.reduce((sum, p) => sum + p.quantity, 0);
    });

    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Orders by status
    const ordersByStatus = {
      "en cours": orders.filter(o => o.status === "en cours").length,
      "on route": orders.filter(o => o.status === "on route").length,
      "arrived": orders.filter(o => o.status === "arrived").length,
    };

    // Revenue by status
    const revenueByStatus = {
      "en cours": orders.filter(o => o.status === "en cours").reduce((sum, o) => sum + o.total, 0),
      "on route": orders.filter(o => o.status === "on route").reduce((sum, o) => sum + o.total, 0),
      "arrived": orders.filter(o => o.status === "arrived").reduce((sum, o) => sum + o.total, 0),
    };

    // Daily revenue - Get month from query (current month by default)
    const monthParam = req.query.month as string; // Format: "YYYY-MM" or "current" or "previous"
    let targetMonth: Date;
    let monthLabel: string;
    
    if (monthParam === "previous") {
      // Previous month
      targetMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      monthLabel = targetMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    } else {
      // Current month (default)
      targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      monthLabel = targetMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    
    // Get first and last day of the target month
    const firstDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const dailyRevenue: { [key: string]: number } = {};
    
    // Initialize all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
      const dayKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      dailyRevenue[dayKey] = 0;
    }

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      // Check if order is in the target month
      if (orderDate >= firstDay && orderDate <= lastDay) {
        const dayKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')}`;
        if (dailyRevenue[dayKey] !== undefined) {
          dailyRevenue[dayKey] += order.total;
        }
      }
    });

    // Total statistics
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalProductsSold = orders.reduce((sum, order) => {
      return sum + order.products.reduce((productSum, product) => productSum + product.quantity, 0);
    }, 0);
    const uniqueClients = new Set(orders.map(order => order.idBuyer?.toString()).filter(Boolean)).size;

    // Comparison data: Current month vs Previous month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    const currentMonthRevenue = orders
      .filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= currentMonthStart && orderDate < now;
      })
      .reduce((sum, order) => sum + order.total, 0);
    
    const previousMonthRevenue = orders
      .filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= previousMonthStart && orderDate <= previousMonthEnd;
      })
      .reduce((sum, order) => sum + order.total, 0);
    
    const currentMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= currentMonthStart && orderDate < now;
    }).length;
    
    const previousMonthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= previousMonthStart && orderDate <= previousMonthEnd;
    }).length;

    // Revenue comparison by product category (if available)
    const revenueByProduct: { [key: string]: number } = {};
    orders.forEach(order => {
      order.products.forEach(product => {
        if (!revenueByProduct[product.name]) {
          revenueByProduct[product.name] = 0;
        }
        revenueByProduct[product.name] += product.price * product.quantity;
      });
    });

    const topProductsByRevenue = Object.entries(revenueByProduct)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalProductsSold,
        totalOrders: orders.length,
        totalClients: uniqueClients,
        monthlyRevenue,
        dailyRevenue,
        dailyRevenueMonth: monthLabel,
        bestProducts,
        topCustomers,
        ordersByStatus,
        revenueByStatus,
        comparison: {
          currentMonthRevenue,
          previousMonthRevenue,
          currentMonthOrders,
          previousMonthOrders,
          revenueChange: previousMonthRevenue > 0 
            ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100)
            : currentMonthRevenue > 0 ? 100 : 0,
          ordersChange: previousMonthOrders > 0
            ? ((currentMonthOrders - previousMonthOrders) / previousMonthOrders * 100)
            : currentMonthOrders > 0 ? 100 : 0,
        },
        topProductsByRevenue,
      },
    });
  } catch (err: unknown) {
    console.error("Get detailed supplier statistics error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get supplier statistics
export const getSupplierStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Get all orders for this supplier
    const orders = await Commande.find({ idSupplier: userId })
      .populate("idBuyer", "firstName lastName email");

    // Calculate statistics
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    
    // Count total products sold (sum of all quantities in all orders)
    const totalProductsSold = orders.reduce((sum, order) => {
      return sum + order.products.reduce((productSum, product) => productSum + product.quantity, 0);
    }, 0);

    // Count unique clients
    const uniqueClients = new Set(orders.map(order => order.idBuyer.toString()));
    const totalClients = uniqueClients.size;

    // Count orders by status
    const ordersByStatus = {
      "en cours": orders.filter(o => o.status === "en cours").length,
      "on route": orders.filter(o => o.status === "on route").length,
      "arrived": orders.filter(o => o.status === "arrived").length,
    };

    // Get recent orders (last 5)
    const recentOrders = orders.slice(0, 5).map(order => ({
      _id: order._id,
      total: order.total,
      status: order.status,
      productsCount: order.products.length,
      buyer: order.idBuyer ? {
        firstName: (order.idBuyer as any).firstName,
        lastName: (order.idBuyer as any).lastName,
        email: (order.idBuyer as any).email,
      } : null,
      createdAt: order.createdAt,
    }));

    // Calculate growth (compare last 30 days with previous 30 days)
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previous30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentOrdersCount = orders.filter(o => new Date(o.createdAt) >= last30Days).length;
    const previousOrdersCount = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= previous30Days && orderDate < last30Days;
    }).length;

    const ordersGrowth = previousOrdersCount > 0 
      ? ((recentOrdersCount - previousOrdersCount) / previousOrdersCount * 100).toFixed(1)
      : recentOrdersCount > 0 ? "100" : "0";

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalProductsSold,
        totalOrders: orders.length,
        totalClients,
        ordersByStatus,
        recentOrders,
        ordersGrowth: parseFloat(ordersGrowth),
      },
    });
  } catch (err: unknown) {
    console.error("Get supplier statistics error:", err);
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

