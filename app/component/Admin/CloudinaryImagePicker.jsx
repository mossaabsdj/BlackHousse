"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { UploadCloud, Image as ImageIcon, Trash2, X, RefreshCw, Check, Link as LinkIcon, Loader2 } from "lucide-react";
import { btnPrimary, btnGhost, btnDanger, inputClass } from "./Ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CloudinaryImagePicker({
  value,
  onChange,
  folder = "blackhousse/products",
  label = "Image du produit",
  hint = "Téléversez une image ou choisissez-en une depuis Cloudinary",
  error,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showManualUrl, setShowManualUrl] = useState(false);
  const [images, setImages] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [search, setSearch] = useState("");
  const [imageToDelete, setImageToDelete] = useState(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const fileInputRef = useRef(null);
  const modalFileInputRef = useRef(null);

  // Load all images from Cloudinary for the media gallery
  const loadGallery = useCallback(async () => {
    setLoadingGallery(true);
    setGalleryError("");
    try {
      const res = await fetch("/api/cloudinary?max_results=80", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors du chargement des images");
      setImages(data.images || []);
    } catch (err) {
      setGalleryError(err.message);
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    if (showModal) {
      loadGallery();
    }
  }, [showModal, loadGallery]);

  // Upload handler (accepts File object)
  const handleUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/cloudinary", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Échec du téléversement vers Cloudinary");
      }

      const uploadedUrl = data.secure_url || data.url;
      onChange(uploadedUrl);
      if (showModal) {
        setShowModal(false);
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (modalFileInputRef.current) modalFileInputRef.current.value = "";
    }
  };

  const onFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDeleteClick = (img, e) => {
    e.stopPropagation();
    setImageToDelete(img);
    setDeleteError("");
  };

  const handleConfirmDeleteImage = async () => {
    if (!imageToDelete) return;
    setDeletingImage(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/cloudinary?public_id=${encodeURIComponent(imageToDelete.public_id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de suppression");

      // If the currently selected image is deleted, clear it
      if (value === imageToDelete.secure_url || value === imageToDelete.url) {
        onChange("");
      }
      setImageToDelete(null);
      loadGallery();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingImage(false);
    }
  };

  // Filtered gallery images by search
  const filteredImages = images.filter((img) => {
    const q = search.trim().toLowerCase();
    return !q || (img.public_id && img.public_id.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-900">{label}</label>
        <button
          type="button"
          onClick={() => setShowManualUrl(!showManualUrl)}
          className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1 transition"
        >
          <LinkIcon className="w-3 h-3" />
          {showManualUrl ? "Masquer URL" : "Saisir URL manuelle"}
        </button>
      </div>

      {hint && <p className="text-xs text-gray-500">{hint}</p>}

      {/* Main Image Selector Box */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-3 space-y-3">
        {value ? (
          <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-200">
            {/* Thumbnail */}
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-100 flex-none bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt="Aperçu"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>

            {/* Info & Actions */}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-700 truncate" title={value}>
                {value}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Remplacer
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
                >
                  Médiathèque Cloudinary
                </button>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Retirer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50/30 rounded-xl text-sm font-semibold text-gray-700 transition"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                  <span>Téléversement Cloudinary...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 text-orange-600" />
                  <span>Téléverser sur Cloudinary</span>
                </>
              )}
            </button>

            {/* Library Button */}
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={isUploading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 hover:border-orange-500 hover:text-orange-600 rounded-xl text-sm font-semibold text-gray-700 transition shadow-sm"
            >
              <ImageIcon className="w-4 h-4 text-orange-500" />
              <span>Choisir depuis Cloudinary</span>
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileInputChange}
        />

        {/* Manual URL Input (optional toggle) */}
        {showManualUrl && (
          <div className="pt-2 border-t border-gray-200">
            <input
              type="url"
              className={inputClass}
              placeholder="https://res.cloudinary.com/... ou URL externe"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        )}

        {uploadError && (
          <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg">
            {uploadError}
          </p>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      {/* Cloudinary Media Library Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">Médiathèque Cloudinary</h3>
                  <p className="text-xs text-gray-500">Tous les fichiers stockés dans votre cloud</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar */}
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3">
              <input
                type="text"
                placeholder="Rechercher une image..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] max-w-xs px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl outline-none focus:border-orange-500"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadGallery}
                  disabled={loadingGallery}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingGallery ? "animate-spin text-orange-500" : ""}`} />
                  Actualiser
                </button>

                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl flex items-center gap-1.5 transition shadow-xs"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  Téléverser nouveau
                </button>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>
            </div>

            {/* Modal Body: Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
              {loadingGallery && (
                <div className="h-60 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <p className="text-sm">Chargement des images depuis Cloudinary...</p>
                </div>
              )}

              {galleryError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-200">
                  {galleryError}
                </div>
              )}

              {!loadingGallery && !galleryError && filteredImages.length === 0 && (
                <div className="h-60 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <p className="text-sm font-semibold">Aucune image trouvée</p>
                  <p className="text-xs">Téléversez votre première image sur Cloudinary en cliquant ci-dessus.</p>
                </div>
              )}

              {!loadingGallery && filteredImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredImages.map((img) => {
                    const isSelected = value === img.secure_url || value === img.url;
                    return (
                      <div
                        key={img.public_id}
                        onClick={() => {
                          onChange(img.secure_url || img.url);
                          setShowModal(false);
                        }}
                        className={`group relative rounded-2xl border overflow-hidden cursor-pointer bg-white transition hover:shadow-md ${
                          isSelected
                            ? "border-orange-500 ring-2 ring-orange-500/20 shadow-md"
                            : "border-gray-200 hover:border-orange-300"
                        }`}
                      >
                        {/* Image Box */}
                        <div className="aspect-square bg-gray-100 overflow-hidden relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.secure_url || img.url}
                            alt={img.public_id}
                            loading="lazy"
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          />

                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md">
                              <Check className="w-4 h-4" />
                            </div>
                          )}

                          {/* Delete from Cloudinary button */}
                          <button
                            type="button"
                            title="Supprimer de Cloudinary"
                            onClick={(e) => handleDeleteClick(img, e)}
                            className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Caption */}
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-gray-900 truncate" title={img.public_id}>
                            {img.public_id.split("/").pop()}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                            <span>{img.format?.toUpperCase()}</span>
                            <span>{img.width}×{img.height}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
              <span>{filteredImages.length} image(s) Cloudinary trouvée(s)</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={btnGhost}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={Boolean(imageToDelete)} onOpenChange={(open) => !open && setImageToDelete(null)}>
        <AlertDialogContent className="bg-white border border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 font-bold text-lg">
              Supprimer l'image
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-sm space-y-2">
              <span className="block">
                Supprimer définitivement cette image (<code className="font-semibold text-gray-900 text-xs bg-gray-100 px-1 py-0.5 rounded">{imageToDelete?.public_id}</code>) de Cloudinary ?
              </span>
              <span className="block text-red-600 text-xs font-semibold">
                ⚠️ Cette action est irréversible. L'image ne sera plus accessible si elle est utilisée ailleurs.
              </span>
              {deleteError && (
                <span className="block text-xs font-semibold text-red-700 bg-red-50 p-2 rounded border border-red-200">
                  {deleteError}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={deletingImage} className="border-gray-300 text-gray-700 hover:bg-gray-100">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingImage}
              onClick={handleConfirmDeleteImage}
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              {deletingImage ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

