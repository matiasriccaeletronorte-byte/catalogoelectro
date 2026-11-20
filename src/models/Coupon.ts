import { model, models, Schema } from "mongoose";

const couponSchema = new Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: { type: String, enum: ["percent", "fixed"], required: true },
  value: { type: Number, required: true, min: 0 },
  minTotal: { type: Number, default: 0, min: 0 },
  endsAt: { type: Date, default: null },
  // artículos a los que aplica (vacío = todos); se guarda nombre y código para mostrarlos en el admin
  items: { type: [{ productId: { type: String, required: true }, sku: { type: String, default: "" }, name: { type: String, default: "" }, _id: false }], default: [] },
  // duración con la que se activó por última vez (para reiniciarlo con el mismo tiempo)
  durationMinutes: { type: Number, default: 0, min: 0 },
  note: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export const CouponModel = models.Coupon || model("Coupon", couponSchema);
