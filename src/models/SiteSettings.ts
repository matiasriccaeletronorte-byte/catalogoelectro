import { model, models, Schema } from "mongoose";

const siteSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  whatsappPhone: { type: String, default: "" },
  whatsappTemplate: { type: String, default: "" },
  bbvaDates: { type: [String], default: [] }
}, { timestamps: true });

export const SiteSettingsModel = models.SiteSettings || model("SiteSettings", siteSettingsSchema);
