import mongoose, { Schema, Document } from "mongoose";

export interface IProblem extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  phone: string;
  message: string;
  is_read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProblemSchema = new Schema<IProblem>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "problems",
  }
);

// Index for faster lookups
ProblemSchema.index({ email: 1 });
ProblemSchema.index({ is_read: 1 });

const Problem = mongoose.model<IProblem>("Problem", ProblemSchema);

export default Problem;
