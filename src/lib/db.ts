import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cache = global.mongooseCache ?? { connection: null, promise: null };
global.mongooseCache = cache;

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta MONGODB_URI. Copiá .env.example a .env.local.");
  if (cache.connection) return cache.connection;
  if (!cache.promise) cache.promise = mongoose.connect(uri);
  cache.connection = await cache.promise;
  return cache.connection;
}
