import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  idSender: mongoose.Types.ObjectId;
  idReceiver: mongoose.Types.ObjectId;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    idSender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender ID is required"],
    },
    idReceiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Receiver ID is required"],
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: ["order_status", "new_order", "system"],
      default: "system",
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

// Indexes for faster queries
NotificationSchema.index({ idReceiver: 1, isRead: 1 });
NotificationSchema.index({ idReceiver: 1, createdAt: -1 });
NotificationSchema.index({ idSender: 1 });

export default mongoose.model<INotification>("Notification", NotificationSchema);
