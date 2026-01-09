import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  purchasePrice: number; // prix d'achat
  sellingPrice: number; // prix de vente
  quantity: number;
  category: string;
  deliveryTime: string; // délai de livraison
  brand: string;
  productType: string; // "Labo médical" or "labo d'ana pathologies"
  images: string[]; // Array of image paths
  video?: string; // Video file path (optional)
  supplierId: mongoose.Types.ObjectId; // Reference to the supplier who created this product
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    purchasePrice: {
      type: Number,
      required: [true, "Purchase price (prix d'achat) is required"],
      min: [0, "Purchase price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price (prix de vente) is required"],
      min: [0, "Selling price cannot be negative"],
    },
    images: {
      type: [String],
      default: [],
    },
    video: {
      type: String,
      required: false,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    deliveryTime: {
      type: String,
      required: [true, "Delivery time is required"],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    productType: {
      type: String,
      required: [true, "Product type is required"],
      enum: ["Labo médical", "labo d'ana pathologies"],
      default: "Labo médical",
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Supplier ID is required"],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
ProductSchema.index({ supplierId: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ productType: 1 });
ProductSchema.index({ name: "text" }); // Text search index

export default mongoose.model<IProduct>("Product", ProductSchema);

