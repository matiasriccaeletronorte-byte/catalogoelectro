import { InferSchemaType, model, models, Schema } from "mongoose";

const productSchema = new Schema({
  sku: { type: String, trim: true, index: true, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true, index: true },
  category: { type: String, required: true },
  subCategory: { type: String, default: "" },
  brand: { type: String, default: "" },
  features: { type: [String], default: [] },
  outlet: { type: Boolean, default: false },
  image: { type: String, default: "" },
  images: { type: [String], default: [] }
}, { timestamps: true });

productSchema.index({ active: 1, stock: 1, category: 1, createdAt: -1 });
productSchema.index({ name: "text", description: "text", brand: "text", category: "text", sku: "text" });

export type ProductDocument = InferSchemaType<typeof productSchema>;
export const ProductModel = models.Product || model("Product", productSchema);
