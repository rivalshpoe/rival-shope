"use client";

import { useMutation } from "@tanstack/react-query";
import { uploadAdminImage } from "@/lib/api/endpoints/adminUploads";

/** Uploads one image file → `{ url, thumbnailUrl }`. */
export function useUploadAdminImage() {
  return useMutation({
    mutationFn: (file: File) => uploadAdminImage(file),
  });
}
