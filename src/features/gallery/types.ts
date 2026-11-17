import type { Photo, PhotoFilter, PhotoPage } from "@/contracts/album";
import type {
  GalleryAccess,
  GalleryAlbum,
  GalleryState,
  SharePolicy,
} from "@/contracts/share";

export type {
  GalleryAccess,
  GalleryAlbum,
  GalleryState,
  Photo,
  PhotoFilter,
  PhotoPage,
  SharePolicy,
};

export interface LightboxState {
  photoIndex: number;
  isOpen: boolean;
}
