"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { signIn } from "next-auth/react";
import { useSession, signOut } from "next-auth/react";

import { User, Mail, Phone, Globe, Lock, Loader2, Edit3 } from "lucide-react";
import Swal from "sweetalert2";
import LoadingPage from "@/app/component/loading/page";

export default function CompteParamPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
  });
  const { data: session, status, update } = useSession();

  const [loading, setLoading] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    console.log(session);
  }, [session]);

  // ✅ Fetch user account info
  useEffect(() => {
    const fetchCompte = async () => {
      try {
        setLoading(true);
        const email = session?.user.email;
        if (!email) {
          return;
        }
        const res = await fetch(
          `/api/compte?email=${encodeURIComponent(email)}`
        );
        const data = await res.json();

        if (res.ok) {
          setForm({
            fullName: data.fullName || "",
            email: data.email || "",
            phone: data.phone || "",
            country: data.country || "",
          });
        } else {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: data.error || "Unable to load your information.",
          });
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Network Error",
          text: "Unable to fetch account data.",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchCompte();
  }, [session]);

  // ✅ Update account info
  const handleUpdate = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/compte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        await update({
          user: {
            ...session.user,
            email: newEmail || session.user.email,
            name: form.fullName,
          },
        });
        Swal.fire({
          icon: "success",
          title: "Profile Updated",
          text: "Your information has been successfully updated.",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Something went wrong while updating.",
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Network Error",
        text: "Unable to update account.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Change password
  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 8) {
      Swal.fire({
        icon: "warning",
        title: "Weak Password",
        text: "Password must be at least 8 characters long.",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/compte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Password Updated",
          timer: 1500,
          showConfirmButton: false,
        });
        setPasswordModal(false);
        setNewPassword("");
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Unable to change password.",
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Network Error",
        text: "Failed to connect to the server.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Change email
  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes("@")) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Email",
        text: "Please enter a valid email address.",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/compte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, newEmail }),
      });
      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Email Updated",
          text: "Your email address has been changed successfully.",
          timer: 1500,
          showConfirmButton: false,
        });

        setForm({ ...form, email: newEmail });
        setEmailModal(false);
        setNewEmail("");

        Swal.fire({
          icon: "info",
          title: "Please log in again",
          text: "Your session needs to be refreshed after this update.",
        }).then(() => {
          signOut({ callbackUrl: "/Login" });
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.error || "Unable to update email.",
        });
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Network Error",
        text: "Unable to contact the server.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <LoadingPage isVisible={true} />}

      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <Card className="w-full max-w-lg shadow-xl border-none rounded-2xl bg-white">
          <CardContent className="p-8 space-y-6">
            {/* Profile Header */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="bg-black text-white w-24 h-24 rounded-full flex items-center justify-center shadow-lg">
                <User size={50} />
              </div>
              <h2 className="text-2xl font-semibold text-gray-800">
                Account Settings
              </h2>
              <p className="text-sm text-gray-500">
                Manage your personal information and account security.
              </p>
            </div>

            {/* Info Form */}
            <div className="space-y-4 mt-8">
              <div className="relative">
                <User
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  className="pl-10"
                  placeholder="Full Name"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </div>

              <div className="relative">
                <Mail
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  className="pl-10"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  disabled
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2 text-gray-600 border-gray-300"
                  onClick={() => setEmailModal(true)}
                >
                  <Edit3 size={15} className="mr-1" /> Edit
                </Button>
              </div>

              <div className="relative">
                <Phone
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  className="pl-10"
                  type="tel"
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^\d+]/g, "");
                    if (value.includes("+"))
                      value = "+" + value.replace(/\+/g, "");
                    if (value.length > 13) value = value.slice(0, 13);
                    setForm({ ...form, phone: value });
                  }}
                />
              </div>

              <div className="relative">
                <Globe
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  className="pl-10"
                  placeholder="Country"
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-between items-stretch sm:items-center pt-2">
                <Button
                  variant="outline"
                  className="border-gray-300 text-gray-700 w-full sm:w-auto"
                  onClick={() => setPasswordModal(true)}
                >
                  <Lock className="mr-2" size={16} /> Change Password
                </Button>

                <Button
                  className="bg-black text-white px-6 w-full sm:w-auto"
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : null}
                  Update Info
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🔐 Password Modal */}
      <Dialog open={passwordModal} onOpenChange={setPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-end">
            <Button variant="outline" onClick={() => setPasswordModal(false)}>
              Cancel
            </Button>
            <Button
              className="bg-black text-white"
              onClick={handlePasswordChange}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 📧 Email Modal */}
      <Dialog open={emailModal} onOpenChange={setEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              type="email"
              placeholder="New Email Address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-end">
            <Button variant="outline" onClick={() => setEmailModal(false)}>
              Cancel
            </Button>
            <Button className="bg-black text-white" onClick={handleEmailChange}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
