import { Request, Response } from "express";
import mongoose from "mongoose";
import Payment from "../../entity/Payment";
import Commande from "../../entity/Commande";
import User from "../../entity/User";
import { AuthRequest } from "../../middleware/auth.middleware";

// Create payment (after uploading image)
export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { id_commande, total } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    if (!id_commande || total === undefined || total === null) {
      res.status(400).json({
        success: false,
        message: "Commande ID and total are required",
      });
      return;
    }

    // Convert total to number
    const paymentTotal = typeof total === "string" ? parseFloat(total) : Number(total);
    if (isNaN(paymentTotal)) {
      res.status(400).json({
        success: false,
        message: "Invalid total value",
      });
      return;
    }

    if (!file) {
      res.status(400).json({
        success: false,
        message: "Payment image is required",
      });
      return;
    }

    // Verify the commande exists and belongs to the user
    const commande = await Commande.findById(id_commande);
    if (!commande) {
      res.status(404).json({
        success: false,
        message: "Commande not found",
      });
      return;
    }

    // Verify user is the buyer of this commande
    if (commande.idBuyer.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only create payment for your own orders",
      });
      return;
    }

    // Check if payment already exists for this commande
    const existingPayment = await Payment.findOne({ id_commande });
    if (existingPayment) {
      res.status(400).json({
        success: false,
        message: "Payment already exists for this commande",
      });
      return;
    }

    // Verify total matches commande total (with tolerance for floating point precision)
    const commandeTotal = Number(commande.total);
    const totalDiff = Math.abs(commandeTotal - paymentTotal);
    if (totalDiff > 0.01) { // Allow 0.01 DA difference for floating point precision
      res.status(400).json({
        success: false,
        message: `Total does not match commande total. Commande total: ${commandeTotal} DA, Provided: ${paymentTotal} DA`,
      });
      return;
    }

    // Create payment
    const payment = new Payment({
      id_commande: commande._id,
      id_owner: userId,
      total: paymentTotal, // Use the converted number
      image: file.filename, // Store the filename
    });

    await payment.save();

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: payment,
    });
  } catch (err: unknown) {
    console.error("Create payment error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get payment by commande ID
export const getPaymentByCommande = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { commandeId } = req.params;

    // Verify the commande exists and belongs to the user
    const commande = await Commande.findById(commandeId);
    if (!commande) {
      res.status(404).json({
        success: false,
        message: "Commande not found",
      });
      return;
    }

    // Verify user is the buyer or supplier of this commande
    if (commande.idBuyer.toString() !== userId && commande.idSupplier.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: "You can only view payment for your own orders",
      });
      return;
    }

    // Get payment
    const payment = await Payment.findOne({ id_commande: commandeId })
      .populate("id_owner", "firstName lastName email")
      .populate("id_commande");

    if (!payment) {
      res.status(404).json({
        success: false,
        message: "Payment not found for this commande",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (err: unknown) {
    console.error("Get payment by commande error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get all payments for a user (client)
export const getUserPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const payments = await Payment.find({ id_owner: userId })
      .populate("id_commande")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (err: unknown) {
    console.error("Get user payments error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
