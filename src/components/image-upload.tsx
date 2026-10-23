"use client";
import { LoadingState } from "@/components/ui/primitives";
import { useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { dataError } from "@/lib/errors";
export function ImageUpload({
  path,
  images,
  onChange,
  max = 4,
}: {
  path: string;
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}) {
  const [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState("");
  return (
    <div>
      <label>
        Photographs you have permission to publish (up to {max})
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={progress !== null}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (images.length + files.length > max) {
              setError(`Choose at most ${max} photographs.`);
              return;
            }
            setError("");
            const added: string[] = [];
            try {
              for (const file of files) {
                if (
                  file.size > 10 * 1024 * 1024 ||
                  !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                )
                  throw new Error("Use a JPEG, PNG or WebP under 10 MB.");
                const bitmap = await createImageBitmap(file);
                const canvas = document.createElement("canvas"),
                  scale = Math.min(
                    1,
                    1600 / Math.max(bitmap.width, bitmap.height),
                  );
                canvas.width = Math.round(bitmap.width * scale);
                canvas.height = Math.round(bitmap.height * scale);
                canvas
                  .getContext("2d")!
                  .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                bitmap.close();
                const blob = await new Promise<Blob>((resolve, reject) =>
                  canvas.toBlob(
                    (b) =>
                      b
                        ? resolve(b)
                        : reject(new Error("Could not process image.")),
                    "image/jpeg",
                    0.84,
                  ),
                );
                const target = ref(
                  storage,
                  `${path}/${crypto.randomUUID()}.jpg`,
                );
                const task = uploadBytesResumable(target, blob, {
                  contentType: "image/jpeg",
                });
                await new Promise<void>((resolve, reject) =>
                  task.on(
                    "state_changed",
                    (s) =>
                      setProgress(
                        Math.round((s.bytesTransferred * 100) / s.totalBytes),
                      ),
                    reject,
                    () => resolve(),
                  ),
                );
                added.push(await getDownloadURL(target));
                onChange([...images, ...added]);
              }
            } catch (e) {
              setError(dataError(e));
            } finally {
              setProgress(null);
            }
          }}
        />
      </label>
      {progress !== null && (
        <LoadingState size={64} label={`Uploading ${progress}%`} />
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="upload-previews">
        {images.map((image, i) => (
          <div key={image}>
            <img src={image} alt={`Uploaded photograph ${i + 1}`} />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, n) => n !== i))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
