import { model, models, Schema } from "mongoose";

const categorySchema = new Schema({ name: { type: String, required: true, unique: true, trim: true }, subCategories: { type: [String], default: [] } }, { timestamps: true });
export const CategoryModel = models.Category || model("Category", categorySchema);
