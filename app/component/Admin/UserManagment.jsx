"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  UserPlus,
  Loader2,
} from "lucide-react";
import Swal from "sweetalert2";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n/I18nContext";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function UserManagement() {
  const { t, isRTL } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    role: "CLIENT",
    password: "",
  });

  useEffect(() => {
    if (session?.user?.email) {
      fetchUsers(session.user.email);
    }
  }, [session]);

  const fetchUsers = async (currentEmail) => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/users?email=${encodeURIComponent(currentEmail)}`
      );
      const data = await res.json();

      if (res.ok) setUsers(data);
      else throw new Error(data.error || t("common.error", {}, "Error"));
    } catch (err) {
      Swal.fire(t("common.error", {}, "Error"), err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = (users || []).filter(
    (user) =>
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = () => {
    setCurrentUser(null);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      country: "",
      role: "CLIENT",
      password: "",
    });
    setIsDialogOpen(true);
  };

  const handleEditUser = (user) => {
    setCurrentUser(user);
    setFormData({
      fullName: user.fullName || "",
      email: user.email || "",
      phone: user.phone || "",
      country: user.country || "",
      role: user.role || "CLIENT",
      password: "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users?id=${userToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire(
          t("common.success", {}, "Succès"),
          t("Admin.users.userDeleted", {}, "L'utilisateur a été supprimé."),
          "success"
        );
        fetchUsers(session?.user?.email);
      } else {
        Swal.fire(t("common.error", {}, "Error"), data.error || t("common.error", {}, "Error"), "error");
      }
    } catch (err) {
      Swal.fire(t("common.error", {}, "Error"), err.message, "error");
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.fullName.trim()) {
      Swal.fire(t("common.error", {}, "Attention"), t("Admin.users.nameRequired", {}, "Le nom complet est requis."), "warning");
      return;
    }

    if (!formData.email.trim()) {
      Swal.fire(t("common.error", {}, "Attention"), t("Admin.users.emailRequired", {}, "L'e-mail est requis."), "warning");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Swal.fire(t("common.error", {}, "Attention"), t("Admin.users.emailInvalid", {}, "Veuillez entrer une adresse e-mail valide."), "warning");
      return;
    }

    if (!formData.role) {
      Swal.fire(t("common.error", {}, "Attention"), t("Admin.users.roleRequired", {}, "Le rôle de l'utilisateur est requis."), "warning");
      return;
    }

    if (!currentUser && (!formData.password || formData.password.length < 8)) {
      Swal.fire(
        t("common.error", {}, "Attention"),
        t("Admin.users.passwordLengthWarning", {}, "Le mot de passe doit comporter au moins 8 caractères pour les nouveaux utilisateurs."),
        "warning"
      );
      return;
    }

    if (formData.phone && !/^\+?\d{6,15}$/.test(formData.phone)) {
      Swal.fire(
        t("common.error", {}, "Attention"),
        t("Admin.users.phoneInvalid", {}, "Le numéro de téléphone ne doit contenir que des chiffres."),
        "warning"
      );
      return;
    }

    try {
      setLoading(true);
      const method = currentUser ? "PUT" : "POST";
      const body = currentUser ? { id: currentUser.id, ...formData } : formData;

      const res = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire(
          t("common.success", {}, "Succès"),
          currentUser
            ? t("Admin.users.userUpdated", {}, "Utilisateur mis à jour avec succès !")
            : t("Admin.users.userCreated", {}, "Utilisateur créé avec succès !"),
          "success"
        );
        fetchUsers(session?.user?.email);
        setIsDialogOpen(false);
      } else {
        Swal.fire(t("common.error", {}, "Error"), data.error || t("common.error", {}, "Error"), "error");
      }
    } catch (err) {
      Swal.fire(t("common.error", {}, "Error"), err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    return role === "ADMIN" ? "bg-black text-white" : "bg-gray-200 text-black";
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-2">
            {t("Admin.users.title", {}, "Gestion des utilisateurs")}
          </h1>
          <p className="text-gray-600 text-sm">
            {t("Admin.users.subtitle", {}, "Gérez les utilisateurs de votre application et leurs rôles")}
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 px-2 sm:px-5 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            <Input
              type="text"
              placeholder={t("Admin.users.searchPlaceholder", {}, "Rechercher des utilisateurs...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-10 border-gray-300 focus:border-black focus:ring-black"
            />
          </div>
          <Button
            onClick={handleAddUser}
            className="bg-black text-white hover:bg-gray-800 self-start sm:self-auto flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {t("Admin.users.addUser", {}, "Ajouter un utilisateur")}
          </Button>
        </div>

        {/* Users Table */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5 text-start text-xs font-semibold text-black uppercase tracking-wider">
                    {t("Admin.users.fullName", {}, "Nom complet")}
                  </th>
                  <th className="px-6 py-3.5 text-start text-xs font-semibold text-black uppercase tracking-wider">
                    {t("Admin.users.email", {}, "E-mail")}
                  </th>
                  <th className="px-6 py-3.5 text-start text-xs font-semibold text-black uppercase tracking-wider">
                    {t("Admin.users.phone", {}, "Téléphone")}
                  </th>
                  <th className="px-6 py-3.5 text-start text-xs font-semibold text-black uppercase tracking-wider">
                    {t("Admin.users.country", {}, "Pays")}
                  </th>
                  <th className="px-6 py-3.5 text-start text-xs font-semibold text-black uppercase tracking-wider">
                    {t("Admin.users.role", {}, "Rôle")}
                  </th>
                  <th className="px-6 py-3.5 text-start text-xs font-semibold text-black uppercase tracking-wider">
                    {t("Admin.users.createdAt", {}, "Date de création")}
                  </th>
                  <th className="px-6 py-3.5 text-end text-xs font-semibold text-black uppercase tracking-wider">
                    {t("common.actions", {}, "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {user.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" dir="ltr">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" dir="ltr">
                      {user.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.country || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role === "ADMIN" ? t("Admin.users.roleAdmin", {}, "Admin") : t("Admin.users.roleClient", {}, "Client")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" dir="ltr">
                      {user.createdAt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-end text-sm">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t("common.actions", {}, "Actions")}
                            className="hover:bg-gray-100"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-white border-gray-200"
                        >
                          <DropdownMenuItem
                            onClick={() => handleEditUser(user)}
                            className="cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" />
                            {t("common.edit", {}, "Modifier")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(user)}
                            className="cursor-pointer text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t("common.delete", {}, "Supprimer")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            {t("common.noResults", {}, "Aucun utilisateur trouvé.")}
          </div>
        )}

        {/* Add/Edit User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-white border-gray-200 sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-black">
                {currentUser
                  ? t("Admin.users.editUser", {}, "Modifier l'utilisateur")
                  : t("Admin.users.addUser", {}, "Ajouter un utilisateur")}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                {currentUser
                  ? t("Admin.users.subtitle", {}, "Mettre à jour les informations de l'utilisateur.")
                  : t("Admin.users.subtitle", {}, "Remplissez les détails pour créer un compte utilisateur.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName" className="text-black text-start">
                  {t("Admin.users.fullName", {}, "Nom complet")} *
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-black text-start">
                  {t("Admin.users.email", {}, "E-mail")} *
                </Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-black text-start">
                  {t("Admin.users.phone", {}, "Téléphone")}
                </Label>
                <Input
                  id="phone"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country" className="text-black text-start">
                  {t("Admin.users.country", {}, "Pays")}
                </Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role" className="text-black text-start">
                  {t("Admin.users.role", {}, "Rôle")} *
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger className="border-gray-300 focus:border-black focus:ring-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    <SelectItem value="CLIENT">{t("Admin.users.roleClient", {}, "Client")}</SelectItem>
                    <SelectItem value="ADMIN">{t("Admin.users.roleAdmin", {}, "Admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!currentUser && (
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-black text-start">
                    {t("Admin.users.password", {}, "Mot de passe")} *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="border-gray-300 focus:border-black focus:ring-black"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-300 hover:bg-gray-100"
              >
                {t("common.cancel", {}, "Annuler")}
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-black text-white hover:bg-gray-800"
              >
                {currentUser
                  ? t("common.save", {}, "Enregistrer")
                  : t("common.add", {}, "Ajouter")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="bg-white border-gray-200">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-black font-bold">
                {t("Admin.users.deleteTitle", {}, "Supprimer l'utilisateur")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                {t("Admin.users.deleteConfirm", {}, "Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")}
                {userToDelete && (
                  <span className="block mt-2 font-semibold text-black">
                    {userToDelete.fullName} ({userToDelete.email})
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-2 justify-end">
              <AlertDialogCancel
                disabled={loading}
                className="border-gray-300 hover:bg-gray-100"
              >
                {t("common.cancel", {}, "Annuler")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={loading}
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white hover:bg-red-700 font-bold flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? t("common.deleting", {}, "Suppression...") : t("common.delete", {}, "Supprimer")}</span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
