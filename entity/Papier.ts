import mongoose, { Schema, Document } from "mongoose";

export interface IPapier extends Document {
  _id: mongoose.Types.ObjectId;
  id_user: mongoose.Types.ObjectId;
  type: string; // "supplier" or "client"
  Tax_number?: string; // Optional, only for suppliers
  identity: string;
  commercial_register?: string; // Optional, only for suppliers
  createdAt: Date;
  updatedAt: Date;
}

const PapierSchema = new Schema<IPapier>(
  {
    id_user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true, // unique: true automatically creates an index
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: ["supplier", "client"],
    },
    Tax_number: {
      type: String,
      required: false, // Only required for suppliers
    },
    identity: {
      type: String,
      required: [true, "Identity document is required"],
    },
    commercial_register: {
      type: String,
      required: false, // Only required for suppliers
    },
  },
  {
    timestamps: true,
  }
);

// Custom validation: Suppliers must have all 3 documents, clients only need identity
PapierSchema.pre("save", async function () {
  if (this.type === "supplier") {
    // Suppliers must have all 3 documents
    if (!this.Tax_number || !this.identity || !this.commercial_register) {
      throw new Error("Suppliers must provide Tax_number, identity, and commercial_register documents");
    }
  } else if (this.type === "client") {
    // Clients only need identity - ensure it exists
    if (!this.identity) {
      throw new Error("Clients must provide identity document");
    }
    // For clients, clear Tax_number and commercial_register if they were somehow set
    // (This shouldn't happen due to controller validation, but we ensure it here)
    this.Tax_number = undefined;
    this.commercial_register = undefined;
  }
});

export default mongoose.model<IPapier>("Papier", PapierSchema);

