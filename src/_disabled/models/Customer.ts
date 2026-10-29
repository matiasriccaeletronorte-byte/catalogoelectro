import { model, models, Schema } from "mongoose";

const customerSchema = new Schema({
  googleId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  picture: { type: String, default: "" }
}, { timestamps: true });

export const CustomerModel = models.Customer || model("Customer", customerSchema);
