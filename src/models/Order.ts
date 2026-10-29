import { model, models, Schema } from "mongoose";

const orderSchema = new Schema({
  customerId: { type: String, required: true, index: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true }
  },
  items: [{ productId: String, name: String, price: Number, quantity: Number }],
  total: { type: Number, required: true },
  status: { type: String, enum: ["pending_review", "approved", "paid", "shipped", "cancelled"], default: "pending_review" },
  inventoryState: { type: String, enum: ["none", "deducted"], default: "none" }
}, { timestamps: true });

export const OrderModel = models.Order || model("Order", orderSchema);
