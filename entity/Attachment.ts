import mongoose, { Schema, Document } from "mongoose";

export interface IAttachment extends Document {
  _id: mongoose.Types.ObjectId;
  id_user: mongoose.Types.ObjectId;
  image: string; // Path to the image file
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    id_user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true, // One attachment per user
      index: true,
    },
    image: {
      type: String,
      required: [true, "Image path is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
AttachmentSchema.index({ id_user: 1 });

export default mongoose.model<IAttachment>("Attachment", AttachmentSchema);

