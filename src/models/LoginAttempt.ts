import { model, models, Schema } from "mongoose";

const loginAttemptSchema = new Schema({
  key: { type: String, required: true, unique: true, index: true },
  role: { type: String, required: true, enum: ["seller", "customer"] },
  count: { type: Number, required: true, default: 0 },
  blockedUntil: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const LoginAttemptModel = models.LoginAttempt || model("LoginAttempt", loginAttemptSchema);
