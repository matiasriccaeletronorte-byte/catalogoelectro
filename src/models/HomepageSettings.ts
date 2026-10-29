import { model, models, Schema } from "mongoose";

const carouselSlideSchema = new Schema({
  tag: { type: String, default: "" },
  title: { type: String, default: "" },
  text: { type: String, default: "" },
  image: { type: String, default: "" }
}, { _id: false });

const bankPromoSchema = new Schema({
  title: { type: String, default: "" },
  description: { type: String, default: "" },
  note: { type: String, default: "" }
}, { _id: false });

const offerTimerSchema = new Schema({
  productId: { type: String, required: true },
  endsAt: { type: String, default: "" }
}, { _id: false });

const homepageSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  bestSellerIds: { type: [String], default: [] },
  offerIds: { type: [String], default: [] },
  offerTimers: { type: [offerTimerSchema], default: [] },
  heroImages: { type: [String], default: [] },
  carouselSlides: { type: [carouselSlideSchema], default: [] },
  bankPromotions: { type: [bankPromoSchema], default: [] }
}, { timestamps: true });

const existingHomepageSettingsModel = models.HomepageSettings;

if (existingHomepageSettingsModel) {
  existingHomepageSettingsModel.schema.add({
    offerTimers: { type: [offerTimerSchema], default: [] },
    heroImages: { type: [String], default: [] }
  });
}

export const HomepageSettingsModel = existingHomepageSettingsModel || model("HomepageSettings", homepageSettingsSchema);
