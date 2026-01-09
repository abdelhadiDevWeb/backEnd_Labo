import mongoose, { Schema, Document } from "mongoose";

export interface ICommande extends Document {
  _id: mongoose.Types.ObjectId;
  total: number;
  products: Array<{
    productId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
  }>;
  idBuyer: mongoose.Types.ObjectId;
  idSupplier: mongoose.Types.ObjectId;
  status: "en cours" | "on route" | "arrived";
  createdAt: Date;
  updatedAt: Date;
}

const CommandeSchema = new Schema<ICommande>(
  {
    total: {
      type: Number,
      required: [true, "Total is required"],
      min: [0, "Total must be positive"],
    },
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: [0, "Price must be positive"],
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, "Quantity must be at least 1"],
        },
      },
    ],
    idBuyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Buyer ID is required"],
    },
    idSupplier: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Supplier ID is required"],
    },
    status: {
      type: String,
      enum: ["en cours", "on route", "arrived"],
      default: "en cours",
    },
  },
  {
    timestamps: true,
    collection: "commandes",
  }
);

// Indexes for faster queries
CommandeSchema.index({ idBuyer: 1 });
CommandeSchema.index({ idSupplier: 1 });
CommandeSchema.index({ status: 1 });
CommandeSchema.index({ createdAt: -1 });

export default mongoose.model<ICommande>("Commande", CommandeSchema);

