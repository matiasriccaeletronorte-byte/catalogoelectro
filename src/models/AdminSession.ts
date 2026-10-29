import { model, models, Schema } from "mongoose";

const adminSessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

export const AdminSessionModel = models.AdminSession || model("AdminSession", adminSessionSchema);
