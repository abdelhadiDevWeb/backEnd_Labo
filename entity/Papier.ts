import mongoose, { Schema, Document } from "mongoose";

export interface IPapier extends Document {
  _id: mongoose.Types.ObjectId;
  id_user: mongoose.Types.ObjectId;
  Tax_number: string;
  identity: string;
  commercial_register: string;
  createdAt: Date;
  updatedAt: Date;
}

const PapierSchema = new Schema<IPapier>(
  {
    id_user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },
    Tax_number: {
      type: String,
      required: [true, "Tax number document is required"],
    },
    identity: {
      type: String,
      required: [true, "Identity document is required"],
    },
    commercial_register: {
      type: String,
      required: [true, "Commercial register document is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster user lookups
PapierSchema.index({ id_user: 1 });

export default mongoose.model<IPapier>("Papier", PapierSchema);

