import { model, models, Schema } from "mongoose";

const categorySchema = new Schema({ name: { type: String, required: true, unique: true, trim: true } }, { timestamps: true });
export const CategoryModel = models.Category || model("Category", categorySchema);
