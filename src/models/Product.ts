import { InferSchemaType, model, models, Schema } from "mongoose";

const productSchema = new Schema({
  sku: { type: String, trim: true, required: true },
  skuKey: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  cashPrice: { type: Number, required: true, min: 0 },
  listPrice: { type: Number, required: true, min: 0 },
  available: { type: Boolean, default: true },
  stock: { type: Number, min: 0 },
  active: { type: Boolean, default: true },
  category: { type: String, required: true, trim: true },
  subCategory: { type: String, default: "", trim: true },
  brand: { type: String, default: "", trim: true },
  features: { type: [String], default: [] },
  outlet: { type: Boolean, default: false },
  image: { type: String, default: "" },
  images: { type: [String], default: [] },
  searchText: { type: String, default: "" }
}, { timestamps: true });

productSchema.index({ active: 1, category: 1, subCategory: 1, brand: 1, listPrice: 1 });
productSchema.index({ active: 1, createdAt: -1 });
productSchema.index({ active: 1, listPrice: 1 });

export type ProductDocument = InferSchemaType<typeof productSchema>;
export const ProductModel = models.Product || model("Product", productSchema);
