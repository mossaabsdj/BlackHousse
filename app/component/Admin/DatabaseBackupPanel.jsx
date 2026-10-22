"use client";

import { useState, useEffect, useRef } from "react";
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Layers,
  UtensilsCrossed,
  Receipt,
  Truck,
  ShoppingBag,
  Sliders,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { api, formatPrice } from "./adminApi";
import { card, btnPrimary, btnGhost, btnDanger, Modal, ErrorBox } from "./Ui";

export default function DatabaseBackupPanel() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  // Export state
  const [exporting, setExporting] = useState(false);

  // Import state
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [importMode, setImportMode] = useState("merge"); // "merge" | "replace"
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [confirmReplaceModal, setConfirmReplaceModal] = useState(false);

  const fileInputRef = useRef(null);

  // Fetch current database statistics
  const loadStats = async (silent = false) => {
    if (!silent) setStatsLoading(true);
    setStatsError("");
    try {
      const data = await api.get("/api/admin/database/stats");
      setStats(data.stats);
    } catch (err) {
      setStatsError(err.message || "Impossible de charger les statistiques de la base");
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Handle Export Download
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/database/export", {
        credentials: "same-origin",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Erreur serveur ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `blackhousse-database-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Erreur lors de l'export : ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Handle JSON file selection and preview analysis
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setImportError("");
    setImportResult(null);
    if (!selected) {
      setFile(null);
      setFilePreview(null);
      return;
    }

    if (!selected.name.endsWith(".json")) {
      setImportError("Veuillez sélectionner un fichier au format .json.");
      setFile(null);
      setFilePreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const parsed = JSON.parse(text);
        const dataObj = parsed.data || parsed;

        const counts = {
          categories: Array.isArray(dataObj.categories) ? dataObj.categories.length : 0,
          products: Array.isArray(dataObj.products) ? dataObj.products.length : 0,
          optionGroups: Array.isArray(dataObj.optionGroups) ? dataObj.optionGroups.length : 0,
          options: Array.isArray(dataObj.options) ? dataObj.options.length : 0,
          municipalities: Array.isArray(dataObj.municipalities) ? dataObj.municipalities.length : 0,
          expenses: Array.isArray(dataObj.expenses) ? dataObj.expenses.length : 0,
          orders: Array.isArray(dataObj.orders) ? dataObj.orders.length : 0,
          comptes: Array.isArray(dataObj.comptes) ? dataObj.comptes.length : 0,
        };

        const totalEntries = Object.values(counts).reduce((a, b) => a + b, 0);

        if (totalEntries === 0) {
          setImportError("Le fichier JSON ne contient aucune collection reconnue (produits, catégories, commandes...).");
          setFile(null);
          setFilePreview(null);
          return;
        }

        setFile(selected);
        setFilePreview({
          name: selected.name,
          sizeKb: Math.round(selected.size / 1024),
          counts,
          totalEntries,
          parsedPayload: parsed,
          exportedAt: parsed?.meta?.exportedAt ? new Date(parsed.meta.exportedAt).toLocaleString("fr-FR") : null,
        });
      } catch (err) {
        setImportError(`Fichier JSON invalide ou corrompu : ${err.message}`);
        setFile(null);
        setFilePreview(null);
      }
    };

    reader.onerror = () => {
      setImportError("Erreur lors de la lecture du fichier.");
    };

    reader.readAsText(selected);
  };

  // Perform Import
  const executeImport = async () => {
    if (!filePreview?.parsedPayload) return;
    setImporting(true);
    setImportError("");
    setImportResult(null);

    try {
      const payload = {
        mode: importMode,
        data: filePreview.parsedPayload.data || filePreview.parsedPayload,
      };

      const res = await api.post("/api/admin/database/import", payload);
      setImportResult(res);
      setFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadStats(true);
    } catch (err) {
      setImportError(err.message || "Erreur lors de l'importation de la base de données.");
    } finally {
      setImporting(false);
      setConfirmReplaceModal(false);
    }
  };

  const handleImportClick = () => {
    if (importMode === "replace") {
      setConfirmReplaceModal(true);
    } else {
      executeImport();
    }
  };

  return (
    <section className="space-y-6">
      {/* Top Header */}
      

      {statsError && <ErrorBox message={statsError} onRetry={() => loadStats()} />}

      {/* Database Snapshot Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <UtensilsCrossed className="w-4 h-4 text-orange-600 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Produits</p>
            <p className="text-lg font-black text-gray-900">{stats.products}</p>
          </div>
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <Layers className="w-4 h-4 text-amber-600 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Catégories</p>
            <p className="text-lg font-black text-gray-900">{stats.categories}</p>
          </div>
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <Sliders className="w-4 h-4 text-blue-600 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Groupes Opt.</p>
            <p className="text-lg font-black text-gray-900">{stats.optionGroups}</p>
          </div>
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <Sliders className="w-4 h-4 text-indigo-600 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Options</p>
            <p className="text-lg font-black text-gray-900">{stats.options}</p>
          </div>
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <Truck className="w-4 h-4 text-emerald-600 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Communes</p>
            <p className="text-lg font-black text-gray-900">{stats.municipalities}</p>
          </div>
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <Receipt className="w-4 h-4 text-red-500 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Dépenses</p>
            <p className="text-lg font-black text-gray-900">{stats.expenses}</p>
          </div>
          <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
            <ShoppingBag className="w-4 h-4 text-purple-600 mx-auto" />
            <p className="text-xs text-gray-500 font-semibold">Commandes</p>
            <p className="text-lg font-black text-gray-900">{stats.orders}</p>
          </div>
          {stats.comptes != null && (
            <div className={`${card} p-3.5 space-y-1 text-center bg-gray-50/50`}>
              <ShieldCheck className="w-4 h-4 text-emerald-600 mx-auto" />
              <p className="text-xs text-gray-500 font-semibold">Comptes</p>
              <p className="text-lg font-black text-gray-900">{stats.comptes}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Export and Import Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ---------------- Export Card ---------------- */}
        <div className={`${card} p-6 space-y-5 flex flex-col justify-between border-orange-100/60`}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Exporter la Base de Données</h3>
                <p className="text-xs text-gray-500">Sauvegarde complète au format JSON</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Générez un fichier JSON sécurisé contenant l'intégralité de vos tables :
              produits, catégories, options et suppléments, communes de livraison, registre des dépenses et historique complet des commandes.
            </p>

            <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-100 space-y-2 text-xs text-orange-950">
              <p className="font-bold flex items-center gap-1.5 text-orange-800">
                <FileJson className="w-4 h-4" /> Format de sauvegarde standard :
              </p>
              <ul className="list-disc list-inside space-y-1 text-orange-900/90 pl-1">
                <li>Compatible avec la fonction d'importation de cette application.</li>
                <li>Horodaté avec métadonnées d'intégrité et compteurs vérifiés.</li>
                <li>Préserve tous les identifiants, relations de catalogue et historiques.</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className={`${btnPrimary} w-full flex items-center justify-center gap-2.5 py-3 shadow-lg shadow-orange-500/25 text-sm`}
            >
              <Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />
              {exporting ? "Génération du fichier..." : "Télécharger la Sauvegarde JSON"}
            </button>
          </div>
        </div>

        {/* ---------------- Import Card ---------------- */}
        <div className={`${card} p-6 space-y-5 flex flex-col justify-between border-blue-100/60`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Restaurer / Importer un Fichier JSON</h3>
                <p className="text-xs text-gray-500">Importez des données depuis une sauvegarde</p>
              </div>
            </div>

            {/* File Dropzone / Picker */}
            <div className="space-y-2">
              <label
                htmlFor="db-file-input"
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50/20 rounded-2xl cursor-pointer transition text-center group"
              >
                <FileJson className="w-8 h-8 text-gray-400 group-hover:text-orange-500 transition mb-2" />
                <span className="font-bold text-sm text-gray-700 group-hover:text-orange-600">
                  {file ? file.name : "Cliquez pour sélectionner un fichier JSON"}
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  Format .json uniquement (ex: blackhousse-database-backup.json)
                </span>
                <input
                  id="db-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {importError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-none mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {/* File Preview Breakdown */}
            {filePreview && (
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    {filePreview.name} ({filePreview.sizeKb} Ko)
                  </span>
                  {filePreview.exportedAt && (
                    <span className="text-blue-700">Sauvegardé le {filePreview.exportedAt}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] pt-1">
                  <div className="p-2 bg-white rounded-lg border border-blue-100 text-center">
                    <p className="text-gray-500">Produits</p>
                    <p className="font-bold text-gray-900">{filePreview.counts.products}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100 text-center">
                    <p className="text-gray-500">Catégories</p>
                    <p className="font-bold text-gray-900">{filePreview.counts.categories}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100 text-center">
                    <p className="text-gray-500">Dépenses</p>
                    <p className="font-bold text-gray-900">{filePreview.counts.expenses}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100 text-center">
                    <p className="text-gray-500">Commandes</p>
                    <p className="font-bold text-gray-900">{filePreview.counts.orders}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100 text-center">
                    <p className="text-gray-500">Comptes</p>
                    <p className="font-bold text-gray-900">{filePreview.counts.comptes ?? 0}</p>
                  </div>
                </div>

                {/* Import Mode Options */}
                <div className="pt-2 space-y-2 border-t border-blue-200/60">
                  <p className="text-xs font-bold text-blue-950">Mode d'importation :</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                        importMode === "merge"
                          ? "bg-white border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold"
                          : "bg-white/60 border-blue-200 text-gray-700 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        value="merge"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                        className="mt-0.5 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <p className="font-bold">Fusionner (Recommandé)</p>
                        <p className="text-[11px] text-gray-500 font-normal">
                          Ajoute et met à jour sans supprimer les données existantes.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                        importMode === "replace"
                          ? "bg-red-50 border-red-500 ring-2 ring-red-500/20 text-red-950 font-bold"
                          : "bg-white/60 border-blue-200 text-gray-700 hover:bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        value="replace"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <div>
                        <p className="font-bold text-red-700">Remplacement complet</p>
                        <p className="text-[11px] text-red-600/80 font-normal">
                          Réinitialise et remplace par le contenu exact du fichier.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Success Report */}
            {importResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2 font-black text-emerald-800 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-none" />
                  <span>{importResult.message}</span>
                </div>
                {importResult.counts && (
                  <p className="text-emerald-700">
                    Éléments importés : {importResult.counts.products} produits, {importResult.counts.categories} catégories,{" "}
                    {importResult.counts.expenses} dépenses, {importResult.counts.orders} commandes.
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-100/70 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Séquences ID et clés primaires resynchronisées avec succès.</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleImportClick}
              disabled={!filePreview || importing}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition ${
                !filePreview
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : importMode === "replace"
                  ? `${btnDanger} shadow-lg shadow-red-500/20`
                  : `${btnPrimary} shadow-lg shadow-orange-500/20`
              }`}
            >
              {importing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Traitement et insertion en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {importMode === "replace"
                    ? "Remplacer la Base par ce Fichier"
                    : "Lancer l'Importation (Fusionner)"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Replace Mode */}
      {confirmReplaceModal && (
        <Modal
          title="Attention : Remplacement complet de la base"
          onClose={() => setConfirmReplaceModal(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setConfirmReplaceModal(false)}
                className={btnGhost}
                disabled={importing}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={executeImport}
                disabled={importing}
                className={`${btnDanger} flex items-center gap-2`}
              >
                {importing && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirmer et Écraser la Base
              </button>
            </>
          }
        >
          <div className="space-y-3 py-2 text-sm text-gray-700">
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-none" />
              <div>
                <p className="font-black text-red-800 text-sm">Action irréversible !</p>
                <p className="mt-1 font-normal text-red-700">
                  Le mode « Remplacement complet » va vider toutes les collections existantes (produits, options, catégories, dépenses, commandes)
                  pour les remplacer par celles présentes dans le fichier <strong>{filePreview?.name}</strong>.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Il est recommandé de faire une sauvegarde de précaution en cliquant sur « Télécharger la Sauvegarde JSON » avant de continuer.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}

