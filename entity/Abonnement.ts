import mongoose, { Schema, Document } from "mongoose";

export interface IAbonnement extends Document {
  _id: mongoose.Types.ObjectId;
  id_user: mongoose.Types.ObjectId;
  type: string;
  price: number;
  start: Date;
  end: Date;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AbonnementSchema = new Schema<IAbonnement>(
  {
    id_user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    type: {
      type: String,
      required: [true, "Subscription type is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    start: {
      type: Date,
      required: [true, "Start date is required"],
    },
    end: {
      type: Date,
      required: [true, "End date is required"],
      validate: {
        validator: function (this: IAbonnement, value: Date) {
          return value > this.start;
        },
        message: "End date must be after start date",
      },
    },
    status: {
      type: Boolean,
      default: true,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "abonnements",
  }
);

// Index for faster queries
AbonnementSchema.index({ id_user: 1 });
AbonnementSchema.index({ end: 1 });

export default mongoose.model<IAbonnement>("Abonnement", AbonnementSchema);
