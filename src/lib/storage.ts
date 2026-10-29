import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { isSafeUploadName, uploadDir } from "@/lib/uploads";

export type StorageDriver = {
  /** Guarda el archivo y devuelve la URL con la que se muestra. */
  put(name: string, data: Buffer, contentType: string): Promise<string>;
  /** Borra un archivo guardado por este mismo driver; ignora cualquier otra URL. */
  remove(url: string): Promise<void>;
};

export type SupabaseConfig = { url: string; serviceKey: string; bucket: string };

const LOCAL_PREFIX = "/api/uploads/";

export function localStorageDriver(dir: string): StorageDriver {
  return {
    async put(name, data) {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), data);
      return `${LOCAL_PREFIX}${name}`;
    },
    async remove(url) {
      const name = url.startsWith(LOCAL_PREFIX) ? url.slice(LOCAL_PREFIX.length) : "";
      if (isSafeUploadName(name)) await unlink(path.join(dir, name)).catch(() => undefined);
    }
  };
}

export function supabaseStorageDriver(config: SupabaseConfig, fetchImpl: typeof fetch = fetch): StorageDriver {
  const base = config.url.replace(/\/+$/, "");
  const objectUrl = (name: string) => `${base}/storage/v1/object/${config.bucket}/${name}`;
  const publicPrefix = `${base}/storage/v1/object/public/${config.bucket}/`;
  const auth = { Authorization: `Bearer ${config.serviceKey}`, apikey: config.serviceKey };
  return {
    async put(name, data, contentType) {
      const response = await fetchImpl(objectUrl(name), {
        method: "POST",
        headers: { ...auth, "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" },
        body: new Uint8Array(data)
      });
      if (!response.ok) throw new Error(`Supabase Storage respondió ${response.status} al subir la imagen.`);
      return `${publicPrefix}${name}`;
    },
    async remove(url) {
      if (!url.startsWith(publicPrefix)) return;
      await fetchImpl(objectUrl(url.slice(publicPrefix.length)), { method: "DELETE", headers: auth }).catch(() => undefined);
    }
  };
}

/** Usa Supabase si están las tres variables; si no, la carpeta local (desarrollo). */
export function getStorage(): StorageDriver {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET } = process.env;
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_BUCKET) {
    return supabaseStorageDriver({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY, bucket: SUPABASE_BUCKET });
  }
  return localStorageDriver(uploadDir());
}
