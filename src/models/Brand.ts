import { model, models, Schema } from "mongoose";

const brandSchema = new Schema({ name: { type: String, required: true, unique: true, trim: true } }, { timestamps: true });
export const BrandModel = models.Brand || model("Brand", brandSchema);
