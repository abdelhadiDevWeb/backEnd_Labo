import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import Commande from "../../entity/Commande";
import User from "../../entity/User";
import Product from "../../entity/Product";
import Attachment from "../../entity/Attachment";
import Abonnement from "../../entity/Abonnement";
import Papier from "../../entity/Papier";
import Problem from "../../entity/Problem";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import Joi from "joi";

// Get admin dashboard statistics
export const getAdminStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Calculate total revenue (sum of all order totals)
    const revenueResult = await Commande.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
        },
      },
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Count users by role
    const usersCount = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const usersByRole: { [key: string]: number } = {};
    usersCount.forEach((item) => {
      usersByRole[item._id] = item.count;
    });

    const totalUsers = (usersByRole.client || 0) + (usersByRole.supplier || 0) + (usersByRole.admin || 0);
    const totalClients = usersByRole.client || 0;
    const totalSuppliers = usersByRole.supplier || 0;

    // Count total orders
    const totalOrders = await Commande.countDocuments();

    // Count total products
    const totalProducts = await Product.countDocuments();

    // Get recent orders (last 10)
    const recentOrders = await Commande.find()
      .populate("idBuyer", "firstName lastName email")
      .populate("idSupplier", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Calculate growth percentages (current month vs previous month)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month revenue
    const currentMonthRevenue = await Commande.aggregate([
      {
        $match: {
          createdAt: { $gte: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
        },
      },
    ]);
    const currentRevenue = currentMonthRevenue[0]?.total || 0;

    // Previous month revenue
    const previousMonthRevenue = await Commande.aggregate([
      {
        $match: {
          createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total" },
        },
      },
    ]);
    const previousRevenue = previousMonthRevenue[0]?.total || 0;

    // Current month orders
    const currentMonthOrders = await Commande.countDocuments({
      createdAt: { $gte: currentMonthStart },
    });

    // Previous month orders
    const previousMonthOrders = await Commande.countDocuments({
      createdAt: { $gte: previousMonthStart, $lt: currentMonthStart },
    });

    // Calculate growth percentages
    const revenueGrowth =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersGrowth =
      previousMonthOrders > 0 ? ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) * 100 : 0;

    // Format recent orders
    const formattedRecentOrders = recentOrders.map((order) => ({
      id: order._id.toString(),
      customer: order.idBuyer
        ? `${(order.idBuyer as any).firstName} ${(order.idBuyer as any).lastName}`
        : "Unknown",
      supplier: order.idSupplier
        ? `${(order.idSupplier as any).firstName} ${(order.idSupplier as any).lastName}`
        : "Unknown",
      productCount: order.products.length,
      amount: order.total,
      status: order.status,
      date: order.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalUsers,
        totalClients,
        totalSuppliers,
        totalOrders,
        totalProducts,
        recentOrders: formattedRecentOrders,
        growth: {
          revenue: {
            current: currentRevenue,
            previous: previousRevenue,
            percentage: Math.round(revenueGrowth * 100) / 100,
          },
          orders: {
            current: currentMonthOrders,
            previous: previousMonthOrders,
            percentage: Math.round(ordersGrowth * 100) / 100,
          },
        },
      },
    });
  } catch (error: any) {
    console.error("Get admin statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admin statistics",
      error: error.message,
    });
  }
};

// Get detailed statistics for charts
export const getDetailedAdminStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get last 12 months of revenue
    const monthlyRevenue = await Commande.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      { $limit: 12 },
    ]);

    // Get orders by status
    const ordersByStatus = await Commande.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
    ]);

    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get users by status
    const usersByStatus = await User.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get products by category
    const productsByCategory = await Product.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get products by type
    const productsByType = await Product.aggregate([
      {
        $group: {
          _id: "$productType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get daily revenue for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyRevenue = await Commande.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          total: { $sum: "$total" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Get top suppliers by revenue
    const topSuppliers = await Commande.aggregate([
      {
        $group: {
          _id: "$idSupplier",
          totalRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "supplier",
        },
      },
      {
        $unwind: "$supplier",
      },
      {
        $project: {
          supplierName: { $concat: ["$supplier.firstName", " ", "$supplier.lastName"] },
          totalRevenue: 1,
          orderCount: 1,
        },
      },
    ]);

    // Get top products by quantity sold
    const topProducts = await Commande.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          name: { $first: "$products.name" },
          totalQuantity: { $sum: "$products.quantity" },
          totalRevenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
    ]);

    // Format monthly revenue
    const formattedMonthlyRevenue = monthlyRevenue.map((item) => ({
      month: `${item._id.month}/${item._id.year}`,
      revenue: item.total,
      orders: item.count,
    }));

    // Format daily revenue
    const formattedDailyRevenue = dailyRevenue.map((item) => ({
      date: `${item._id.day}/${item._id.month}/${item._id.year}`,
      revenue: item.total,
      orders: item.count,
    }));

    // Format orders by status
    const formattedOrdersByStatus = ordersByStatus.map((item) => ({
      status: item._id,
      count: item.count,
      revenue: item.total,
    }));

    // Format users by role
    const formattedUsersByRole = usersByRole.map((item) => ({
      role: item._id,
      count: item.count,
    }));

    // Format users by status
    const formattedUsersByStatus = usersByStatus.map((item) => ({
      status: item._id ? "Actif" : "Inactif",
      count: item.count,
    }));

    res.status(200).json({
      success: true,
      data: {
        monthlyRevenue: formattedMonthlyRevenue,
        dailyRevenue: formattedDailyRevenue,
        ordersByStatus: formattedOrdersByStatus,
        usersByRole: formattedUsersByRole,
        usersByStatus: formattedUsersByStatus,
        productsByCategory: productsByCategory.map((item) => ({
          category: item._id,
          count: item.count,
        })),
        productsByType: productsByType.map((item) => ({
          type: item._id,
          count: item.count,
        })),
        topSuppliers,
        topProducts,
      },
    });
  } catch (error: any) {
    console.error("Get detailed admin statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching detailed statistics",
      error: error.message,
    });
  }
};

// Get all orders for admin with filtering
export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get query parameters for filtering
    const { status, search, page = "1", limit = "50", sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Build filter object
    const filter: any = {};

    // Filter by status
    if (status && status !== "all") {
      filter.status = status;
    }

    // Search filter - we'll handle this after populating
    let searchQuery = "";
    if (search && typeof search === "string" && search.trim() !== "") {
      searchQuery = search.trim();
      // If it's a valid ObjectId, filter by _id
      if (mongoose.Types.ObjectId.isValid(searchQuery)) {
        filter._id = new mongoose.Types.ObjectId(searchQuery);
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Get orders with populated buyer and supplier (without pagination first if searching)
    let orders;
    if (searchQuery && !mongoose.Types.ObjectId.isValid(searchQuery)) {
      // If searching by text, get all matching orders first, then filter and paginate
      orders = await Commande.find(filter)
        .populate("idBuyer", "firstName lastName email phone")
        .populate("idSupplier", "firstName lastName email phone")
        .sort(sort)
        .lean();
    } else {
      // Get total count for pagination
      const totalCount = await Commande.countDocuments(filter);
      
      // Get orders with populated buyer and supplier
      orders = await Commande.find(filter)
        .populate("idBuyer", "firstName lastName email phone")
        .populate("idSupplier", "firstName lastName email phone")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean();
    }

    // Format orders for response and apply search filter if needed
    let formattedOrders = orders.map((order) => ({
      id: order._id.toString(),
      orderNumber: `ORD-${order._id.toString().slice(-8).toUpperCase()}`,
      customer: order.idBuyer
        ? `${(order.idBuyer as any).firstName} ${(order.idBuyer as any).lastName}`
        : "Unknown",
      customerEmail: order.idBuyer ? (order.idBuyer as any).email : "",
      supplier: order.idSupplier
        ? `${(order.idSupplier as any).firstName} ${(order.idSupplier as any).lastName}`
        : "Unknown",
      supplierEmail: order.idSupplier ? (order.idSupplier as any).email : "",
      products: order.products.map((p: any) => ({
        name: p.name,
        quantity: p.quantity,
        price: p.price,
      })),
      productCount: order.products.length,
      totalAmount: order.total,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    // Apply search filter on populated data if search query exists and not filtering by _id
    let totalCount = formattedOrders.length;
    if (searchQuery && !mongoose.Types.ObjectId.isValid(searchQuery)) {
      const searchLower = searchQuery.toLowerCase();
      formattedOrders = formattedOrders.filter((order) => {
        const customerMatch = order.customer.toLowerCase().includes(searchLower) ||
          order.customerEmail.toLowerCase().includes(searchLower);
        const supplierMatch = order.supplier.toLowerCase().includes(searchLower) ||
          order.supplierEmail.toLowerCase().includes(searchLower);
        const productMatch = order.products.some((p: any) =>
          p.name.toLowerCase().includes(searchLower)
        );
        const orderNumberMatch = order.orderNumber.toLowerCase().includes(searchLower);
        return customerMatch || supplierMatch || productMatch || orderNumberMatch;
      });
      totalCount = formattedOrders.length;
      // Apply pagination after filtering
      formattedOrders = formattedOrders.slice(skip, skip + limitNum);
    } else {
      // Get total count for pagination if not searching
      totalCount = await Commande.countDocuments(filter);
    }

    // Get status counts for filter info
    const statusCounts = await Commande.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCountsMap: { [key: string]: number } = {};
    statusCounts.forEach((item) => {
      statusCountsMap[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum) || 1,
          totalCount,
          limit: limitNum,
        },
        filters: {
          statusCounts: statusCountsMap,
        },
      },
    });
  } catch (error: any) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// Get all users (excluding admins) for admin
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get query parameters for filtering
    const { role, search, page = "1", limit = "50", sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Build filter object (exclude admins)
    const filter: any = {
      role: { $ne: "admin" }, // Exclude admin users
    };

    // Filter by role
    if (role && role !== "all" && typeof role === "string") {
      filter.role = role;
    }

    // Search filter
    if (search && typeof search === "string" && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Get total count for pagination
    const totalCount = await User.countDocuments(filter);

    // Get users (excluding password)
    const users = await User.find(filter)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get order counts for each user
    const userIds = users.map((u) => u._id);
    const orderCounts = await Commande.aggregate([
      {
        $match: {
          idBuyer: { $in: userIds },
        },
      },
      {
        $group: {
          _id: "$idBuyer",
          count: { $sum: 1 },
        },
      },
    ]);

    const orderCountsMap: { [key: string]: number } = {};
    orderCounts.forEach((item) => {
      orderCountsMap[item._id.toString()] = item.count;
    });

    // Format users for response
    const formattedUsers = users.map((user) => ({
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      status: user.status,
      laboType: user.laboType,
      ordersCount: orderCountsMap[user._id.toString()] || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    // Get role counts for filter info
    const roleCounts = await User.aggregate([
      {
        $match: {
          role: { $ne: "admin" },
        },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const roleCountsMap: { [key: string]: number } = {};
    roleCounts.forEach((item) => {
      roleCountsMap[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum) || 1,
          totalCount,
          limit: limitNum,
        },
        filters: {
          roleCounts: roleCountsMap,
        },
      },
    });
  } catch (error: any) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// Update user status (block/unblock)
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const adminUser = await User.findById(userId);
    if (!adminUser || adminUser.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    const { userId: targetUserId } = req.params;
    const { status } = req.body;

    if (typeof status !== "boolean") {
      res.status(400).json({
        success: false,
        message: "Status must be a boolean value",
      });
      return;
    }

    // Prevent admin from blocking themselves
    if (targetUserId === userId) {
      res.status(400).json({
        success: false,
        message: "You cannot change your own status",
      });
      return;
    }

    // Find and update user
    const user = await User.findById(targetUserId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Prevent blocking/unblocking admin users
    if (user.role === "admin") {
      res.status(403).json({
        success: false,
        message: "Cannot change status of admin users",
      });
      return;
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      success: true,
      message: status ? "User account has been activated" : "User account has been blocked",
      data: {
        id: user._id.toString(),
        status: user.status,
      },
    });
  } catch (error: any) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message,
    });
  }
};

// Upload admin profile image
export const uploadAdminProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Check if user exists and is an admin
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can upload profile images",
      });
      return;
    }

    // Rename file with userId
    const fileExt = path.extname(file.originalname);
    const newFileName = `${userId}-profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
    const newFilePath = path.join(path.dirname(file.path), newFileName);
    
    // Rename the file
    fs.renameSync(file.path, newFilePath);
    const relativePath = newFilePath.replace(/\\/g, "/");

    // Check if attachment already exists
    const existingAttachment = await Attachment.findOne({ id_user: userId });
    if (existingAttachment) {
      // Delete old file if it exists
      if (existingAttachment.image && fs.existsSync(existingAttachment.image)) {
        try {
          fs.unlinkSync(existingAttachment.image);
        } catch (err) {
          console.error("Error deleting old profile image:", err);
        }
      }
      // Update existing attachment
      existingAttachment.image = relativePath;
      await existingAttachment.save();

      res.status(200).json({
        success: true,
        message: "Profile image updated successfully",
        data: {
          id: existingAttachment._id,
          image: relativePath,
        },
      });
    } else {
      // Create new attachment
      const newAttachment = new Attachment({
        id_user: userId,
        image: relativePath,
      });

      await newAttachment.save();

      res.status(201).json({
        success: true,
        message: "Profile image uploaded successfully",
        data: {
          id: newAttachment._id,
          image: relativePath,
        },
      });
    }
  } catch (err: any) {
    console.error("Upload admin profile image error:", err);
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      file: req.file,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get admin profile image
export const getAdminProfileImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

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
    console.error("Get admin profile image error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get admin profile (with image)
export const getAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get profile image if exists
    const attachment = await Attachment.findOne({ id_user: userId });

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
        status: user.status,
        profileImage: attachment?.image || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Get admin profile error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update admin profile
export const updateAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    const { firstName, lastName, phone, address } = req.body;

    // Validate input
    if (!firstName || !lastName) {
      res.status(400).json({
        success: false,
        message: "First name and last name are required",
      });
      return;
    }

    // Update fields
    user.firstName = firstName;
    user.lastName = lastName;
    if (phone) user.phone = phone;
    if (address) user.address = address;

    await user.save();

    // Get profile image if exists
    const attachment = await Attachment.findOne({ id_user: userId });

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
        profileImage: attachment?.image || null,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Update admin profile error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update admin password
export const updateAdminPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId).select("+password");
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
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

    // Validate new password
    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
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
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err: unknown) {
    console.error("Update admin password error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all admins
export const getAllAdmins = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get query parameters
    const { search, page = "1", limit = "50", sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Build filter object (only admins, exclude current user)
    const filter: any = {
      role: "admin",
      _id: { $ne: new mongoose.Types.ObjectId(userId) }, // Exclude the currently logged-in admin
    };

    // Search filter
    if (search && typeof search === "string" && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Get admins
    const admins = await User.find(filter)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        admins,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err: unknown) {
    console.error("Get all admins error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create new admin
export const createAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can create other admins",
      });
      return;
    }

    // Validate input
    const adminSchema = Joi.object({
      firstName: Joi.string().min(2).max(50).required(),
      lastName: Joi.string().min(2).max(50).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      phone: Joi.string().required(),
      address: Joi.string().min(5).max(200).required(),
    });

    const { error, value } = adminSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { firstName, lastName, email, password, phone, address } = value;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email already registered",
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new admin (status defaults to false)
    const newAdmin = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
      role: "admin",
      status: false, // Default status is false
    });

    await newAdmin.save();

    // Return success response (don't send password)
    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        id: newAdmin._id,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email,
        phone: newAdmin.phone,
        address: newAdmin.address,
        role: newAdmin.role,
        status: newAdmin.status,
        createdAt: newAdmin.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error("Create admin error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update admin status
export const updateAdminStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can update admin status",
      });
      return;
    }

    const { adminId } = req.params;
    const { status } = req.body;

    // Validate status
    if (typeof status !== "boolean") {
      res.status(400).json({
        success: false,
        message: "Status must be a boolean value",
      });
      return;
    }

    // Prevent self-status update
    if (adminId === userId) {
      res.status(400).json({
        success: false,
        message: "You cannot change your own status",
      });
      return;
    }

    // Find and update admin
    const admin = await User.findById(adminId);
    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      });
      return;
    }

    if (admin.role !== "admin") {
      res.status(400).json({
        success: false,
        message: "User is not an admin",
      });
      return;
    }

    admin.status = status;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Admin status updated successfully",
      data: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        status: admin.status,
      },
    });
  } catch (err: unknown) {
    console.error("Update admin status error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get users with status false (for creating subscriptions)
export const getUsersForSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get users with status false, excluding admins
    const users = await User.find({ status: false, role: { $ne: "admin" } })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        users,
      },
    });
  } catch (err: unknown) {
    console.error("Get users for subscription error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Create subscription
export const createSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can create subscriptions",
      });
      return;
    }

    // Validate input
    const subscriptionSchema = Joi.object({
      id_user: Joi.string().required(),
      type: Joi.string().required(),
      price: Joi.number().min(0).required(),
      start: Joi.date().required(),
      end: Joi.date().greater(Joi.ref("start")).required(),
    });

    const { error, value } = subscriptionSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    const { id_user, type, price, start, end } = value;

    // Check if user exists
    const targetUser = await User.findById(id_user);
    if (!targetUser) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Create subscription
    const newSubscription = new Abonnement({
      id_user,
      type,
      price,
      start: new Date(start),
      end: new Date(end),
    });

    await newSubscription.save();

    // Update user status to true
    targetUser.status = true;
    await targetUser.save();

    // Populate user data
    await newSubscription.populate("id_user", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: {
        id: newSubscription._id,
        id_user: newSubscription.id_user,
        type: newSubscription.type,
        price: newSubscription.price,
        start: newSubscription.start,
        end: newSubscription.end,
        createdAt: newSubscription.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error("Create subscription error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all subscriptions
export const getAllSubscriptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    // Get all subscriptions with user data
    const subscriptions = await Abonnement.find()
      .populate("id_user", "firstName lastName email phone")
      .sort({ createdAt: -1 })
      .lean();

    // Add status (active/ended) based on end date
    const now = new Date();
    const subscriptionsWithStatus = subscriptions.map((sub) => ({
      ...sub,
      status: new Date(sub.end) > now ? "active" : "ended",
    }));

    res.status(200).json({
      success: true,
      data: {
        subscriptions: subscriptionsWithStatus,
      },
    });
  } catch (err: unknown) {
    console.error("Get all subscriptions error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update subscription
export const updateSubscription = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can update subscriptions",
      });
      return;
    }

    const { subscriptionId } = req.params;

    // Find subscription
    const subscription = await Abonnement.findById(subscriptionId);
    if (!subscription) {
      res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
      return;
    }

    // Check if subscription has ended
    const now = new Date();
    if (new Date(subscription.end) < now) {
      res.status(400).json({
        success: false,
        message: "Cannot update ended subscription",
      });
      return;
    }

    // Validate input
    const subscriptionSchema = Joi.object({
      type: Joi.string().optional(),
      price: Joi.number().min(0).optional(),
      start: Joi.date().optional(),
      end: Joi.date().optional(),
    });

    const { error, value } = subscriptionSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => detail.message),
      });
      return;
    }

    // Update subscription
    if (value.type) subscription.type = value.type;
    if (value.price !== undefined) subscription.price = value.price;
    
    let newStartDate = subscription.start;
    if (value.start) {
      newStartDate = new Date(value.start);
      subscription.start = newStartDate;
    }
    
    if (value.end) {
      const newEndDate = new Date(value.end);
      // Validate end date is after start
      if (newEndDate <= newStartDate) {
        res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
        return;
      }
      subscription.end = newEndDate;
    }

    await subscription.save();

    // Populate user data
    await subscription.populate("id_user", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: {
        id: subscription._id,
        id_user: subscription.id_user,
        type: subscription.type,
        price: subscription.price,
        start: subscription.start,
        end: subscription.end,
        updatedAt: subscription.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("Update subscription error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get user papers (Papier)
export const getUserPapers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    const { userId: targetUserId } = req.params;

    // Get papers for the user
    const papers = await Papier.findOne({ id_user: targetUserId }).lean();

    res.status(200).json({
      success: true,
      data: {
        papers: papers || null,
      },
    });
  } catch (err: unknown) {
    console.error("Get user papers error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get user documents (Attachment)
export const getUserDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    const { userId: targetUserId } = req.params;

    // Get documents for the user
    const documents = await Attachment.findOne({ id_user: targetUserId }).lean();

    res.status(200).json({
      success: true,
      data: {
        documents: documents || null,
      },
    });
  } catch (err: unknown) {
    console.error("Get user documents error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all problems
export const getAllProblems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    const problems = await Problem.find().sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      data: problems,
    });
  } catch (err: unknown) {
    console.error("Get all problems error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Mark problem as read
export const markProblemAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Verify user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Only admins can access this resource",
      });
      return;
    }

    const { problemId } = req.params;

    const problem = await Problem.findByIdAndUpdate(
      problemId,
      { is_read: true },
      { new: true }
    );

    if (!problem) {
      res.status(404).json({
        success: false,
        message: "Problem not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Problem marked as read",
      data: problem,
    });
  } catch (err: unknown) {
    console.error("Mark problem as read error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
