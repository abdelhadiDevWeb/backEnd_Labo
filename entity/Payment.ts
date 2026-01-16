import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  id_commande: mongoose.Types.ObjectId;
  id_owner: mongoose.Types.ObjectId;
  total: number;
  image: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    id_commande: {
      type: Schema.Types.ObjectId,
      ref: "Commande",
      required: [true, "Commande ID is required"],
      unique: true, // One payment per order
    },
    id_owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
    },
    total: {
      type: Number,
      required: [true, "Total is required"],
      min: [0, "Total must be positive"],
    },
    image: {
      type: String,
      required: [true, "Payment image is required"],
    },
  },
  {
    timestamps: true,
    collection: "payments",
  }
);

// Indexes for faster queries
PaymentSchema.index({ id_commande: 1 });
PaymentSchema.index({ id_owner: 1 });
PaymentSchema.index({ createdAt: -1 });

export default mongoose.model<IPayment>("Payment", PaymentSchema);
