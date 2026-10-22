"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  UserPlus,
} from "lucide-react";
import Swal from "sweetalert2";
import { useSession } from "next-auth/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession(); // ✅ get session from NextAuth

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
      // ✅ Send email to API as query param
      const res = await fetch(
        `/api/users?email=${encodeURIComponent(currentEmail)}`
      );
      const data = await res.json();

      if (res.ok) setUsers(data);
      else throw new Error(data.error || "Failed to fetch users");
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setLoading(false);
    }
  };
  const filteredUsers = users?.filter(
    (user) =>
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      country: user.country || "",
      role: user.role,
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
        Swal.fire("Deleted!", "User has been removed.", "success");
        fetchUsers(session.user.email);
      } else {
        Swal.fire("Error", data.error || "Failed to delete user", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Network error", "error");
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // 🧠 1️⃣ Validate fields before API call
    if (!formData.fullName.trim()) {
      Swal.fire("Warning", "Full name is required.", "warning");
      return;
    }

    if (!formData.email.trim()) {
      Swal.fire("Warning", "Email is required.", "warning");
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Swal.fire("Warning", "Please enter a valid email address.", "warning");
      return;
    }

    if (!formData.role) {
      Swal.fire("Warning", "User role is required.", "warning");
      return;
    }

    if (!currentUser && (!formData.password || formData.password.length < 8)) {
      Swal.fire(
        "Warning",
        "Password must be at least 8 characters long for new users.",
        "warning"
      );
      return;
    }

    if (formData.phone && !/^\+?\d{6,15}$/.test(formData.phone)) {
      Swal.fire(
        "Warning",
        "Phone number must contain only digits (optionally starting with +).",
        "warning"
      );
      return;
    }

    // ✅ Passed all validations, proceed with API call
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
          "Success",
          currentUser
            ? "User updated successfully!"
            : "User created successfully!",
          "success"
        );
        fetchUsers(session.user.email);
        setIsDialogOpen(false);
      } else {
        Swal.fire("Error", data.error || "Failed to save user.", "error");
      }
    } catch (err) {
      Swal.fire("Error", "Network error while saving user.", "error");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeColor = (role) => {
    return role === "ADMIN" ? "bg-black text-white" : "bg-gray-200 text-black";
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-8 self-center flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold text-black mb-2">
            User Management
          </h1>
          <p className="text-gray-600">
            Manage your application users and their roles
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 px-5 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-black focus:ring-black"
            />
          </div>
          <Button
            onClick={handleAddUser}
            className="bg-black text-white hover:bg-gray-800"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Users Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">
                      {user.fullName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.country || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.createdAt}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
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
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(user)}
                            className="cursor-pointer text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
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
          <div className="text-center py-12 text-gray-500">
            No users found matching your search.
          </div>
        )}

        {/* Add/Edit User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-white border-gray-200 sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-black">
                {currentUser ? "Edit User" : "Add New User"}
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                {currentUser
                  ? "Update user information and role."
                  : "Fill in the details to create a new user account."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName" className="text-black">
                  Full Name *
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
                <Label htmlFor="email" className="text-black">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-black">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country" className="text-black">
                  Country
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
                <Label htmlFor="role" className="text-black">
                  Role *
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
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!currentUser && (
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-black">
                    Password *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="border-gray-300 focus:border-black focus:ring-black"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-black text-white hover:bg-gray-800"
              >
                {currentUser ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="bg-white border-gray-200">
            <DialogHeader>
              <DialogTitle className="text-black">Delete User</DialogTitle>
              <DialogDescription className="text-gray-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-black">
                  {userToDelete?.fullName}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
