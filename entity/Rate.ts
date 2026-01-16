import mongoose, { Schema, Document } from "mongoose";

export interface IRate extends Document {
  _id: mongoose.Types.ObjectId;
  id_rater: mongoose.Types.ObjectId;
  id_supplier: mongoose.Types.ObjectId;
  message: string;
  number: number; // Rating from 1 to 5
  createdAt: Date;
  updatedAt: Date;
}

const RateSchema = new Schema<IRate>(
  {
    id_rater: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Rater ID is required"],
    },
    id_supplier: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Supplier ID is required"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    number: {
      type: Number,
      required: [true, "Rating number is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
  },
  {
    timestamps: true,
    collection: "rates",
  }
);

// Indexes for faster queries
RateSchema.index({ id_supplier: 1 });
RateSchema.index({ id_rater: 1 });

// Prevent duplicate ratings from the same user to the same supplier
RateSchema.index({ id_rater: 1, id_supplier: 1 }, { unique: true });

export default mongoose.model<IRate>("Rate", RateSchema);
