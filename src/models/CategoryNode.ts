import { model, models, Schema } from "mongoose";

const categoryNodeSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  nameKey: { type: String, required: true },
  parentId: { type: Schema.Types.ObjectId, default: null },
  // posición manual entre hermanos; sin valor = al final, de la A a la Z
  order: { type: Number }
}, { timestamps: true });

// no puede haber dos hermanos con la misma dirección ni con el mismo nombre (sin tildes ni mayúsculas)
categoryNodeSchema.index({ parentId: 1, slug: 1 }, { unique: true });
categoryNodeSchema.index({ parentId: 1, nameKey: 1 }, { unique: true });

export const CategoryNodeModel = models.CategoryNode || model("CategoryNode", categoryNodeSchema);
