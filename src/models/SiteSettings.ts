import { model, models, Schema } from "mongoose";

const branchSchema = new Schema({
  name: { type: String, default: "" },
  city: { type: String, default: "" },
  phone: { type: String, default: "" },
  whatsapp: { type: String, default: "" },
  query: { type: String, default: "" }
}, { _id: false });

const categoryImageSchema = new Schema({ name: { type: String, default: "" }, image: { type: String, default: "" } }, { _id: false });

const siteSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  whatsappPhone: { type: String, default: "" },
  whatsappTemplate: { type: String, default: "" },
  bbvaDates: { type: [String], default: [] },
  branches: { type: [branchSchema], default: undefined },
  categoryImages: { type: [categoryImageSchema], default: [] }
}, { timestamps: true });

export const SiteSettingsModel = models.SiteSettings || model("SiteSettings", siteSettingsSchema);
