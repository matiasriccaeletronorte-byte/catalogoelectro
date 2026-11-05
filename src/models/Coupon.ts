import { model, models, Schema } from "mongoose";

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: { type: String, enum: ["percent", "fixed"], required: true },
  value: { type: Number, required: true, min: 0 },
  minTotal: { type: Number, default: 0, min: 0 },
  endsAt: { type: Date, default: null },
  note: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const CouponModel = models.Coupon || model("Coupon", couponSchema);
