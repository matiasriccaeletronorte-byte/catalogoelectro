import { model, models, Schema } from "mongoose";

// Direcciones viejas de una categoría (antes de renombrarla o moverla): sirven para redirigir en vez de dar 404.
const categoryRedirectSchema = new Schema({
  fromPath: { type: String, required: true, unique: true },
  nodeId: { type: Schema.Types.ObjectId, required: true }
}, { timestamps: true });

export const CategoryRedirectModel = models.CategoryRedirect || model("CategoryRedirect", categoryRedirectSchema);
