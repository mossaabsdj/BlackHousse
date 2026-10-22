"use client";
import React, { useEffect, useState } from "react";
import object from "@/app/Texts/content.json";
import { fetchData } from "@/lib/FetchData/page"; // Adjust path if needed
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import LoadingPage from "@/app/component/Proogression/page";
import { Progress } from "@/components/ui/progress";

const AddModal = ({ data = {} }) => {
  const [loding, setloading] = useState(false);
  const FirstFields = data?.AddClient?.FirstFields ?? [];
  const Title = data?.AddClient?.Title ?? "";

  const addbutton = data?.AddClient?.AddButton ?? "";
  const labels = object.Labels;

  const [prods, setProds] = useState([]);
  const [values, setValues] = useState({});
  const [emballages, setemballages] = useState([]);
  const [prod, setprod] = useState();
  const [showDialog, setShowDialog] = useState(false);
  const [progress, setProgress] = useState(0);

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      const products = await fetchData({ method: "GET", url: "/api/Product" });
      setProds(products || []);
      // Set initial values after products are loaded
      if (products && products.length > 0) {
        const initialValues = FirstFields.reduce((acc, field) => {
          if (field.type === "image" || field.accessor === "image") {
            acc[field.accessor] = null;
          } else if (field.type === "select") {
            acc[field.accessor] = field.options?.[0] || "";
          } else {
            acc[field.accessor] = "";
          }
          if (field.accessor === "productId") {
            acc[field.accessor] = products[0].id || "";
          }
          return acc;
        }, {});
        setValues(initialValues);
        setprod(products[0]);
      }
    };
    fetchProducts();
    // eslint-disable-next-line
  }, [FirstFields]);

  // Update emballages when product changes
  useEffect(() => {
    const filteredEmballages = prod?.emballages ? prod.emballages : [];
    setemballages(filteredEmballages);
  }, [values.productId, prod]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === "file") {
      setValues({ ...values, [name]: files[0] });
    } else {
      setValues({ ...values, [name]: value });
      if (name === "productId") {
        const selectedProduct = prods?.find(
          (p) => Number(p.id) === Number(value)
        );
        setprod(selectedProduct);
      }
    }
  };

  const onSubmit = async (values) => {
    setloading(true);
    const response = await fetchData({
      method: "POST",
      url: "/api/Commande",
      body: values,
    });
    setloading(false);
    setShowDialog(true);
    // Optionally reset form or show success
  };

  // Show loading until products are loaded
  if (!prods.length) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-3xl min-h-[520px] p-4 sm:p-10 mx-auto animate-pulse">
        {/* Title */}
        <div className="h-6 w-2/3 bg-gray-200 rounded mb-6 mx-auto"></div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-4 w-1/2 bg-gray-300 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-gray-200 rounded mt-6" />

        {/* Submit Button */}
        <div className="mt-8 h-12 w-full bg-gray-300 rounded-xl" />
      </div>
    );
  }

  return (
    <>
      {loding && <LoadingPage isVisible={true} />}
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 w-full max-w-3xl min-h-[520px] p-4 sm:p-4 mx-auto max-w-3xl flex flex-col transition-all duration-300">
        {/* Title */}
        <h1 className="text-2xl sm:text-2xl font-bold mb-4 text-center">
          {Title}
        </h1>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
          className="w-full flex flex-col flex-1"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 gap-1 flex-1">
            {FirstFields?.map((field) => {
              if (field.accessor === "productId") {
                return (
                  <div key={field.accessor}>
                    <label
                      htmlFor={field.accessor}
                      className="block text-gray-700 font-medium mb-1"
                    >
                      {field.label}
                    </label>
                    <select
                      id={field.accessor}
                      name={field.accessor}
                      value={values[field.accessor]}
                      onChange={handleChange}
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      {prods?.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              if (field.type === "select" && field.accessor === "region") {
                return (
                  <div key={field.accessor}>
                    <label
                      htmlFor={field.accessor}
                      className="block text-gray-700 font-medium mb-1"
                    >
                      {field.label}
                    </label>
                    <select
                      id={field.accessor}
                      name={field.accessor}
                      value={values[field.accessor]}
                      onChange={handleChange}
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (field.type === "image" || field.accessor === "image") {
                return (
                  <div key={field.accessor}>
                    <label
                      htmlFor={field.accessor}
                      className="block text-gray-700 font-medium mb-1"
                    >
                      {field.label}
                    </label>
                    <input
                      id={field.accessor}
                      name={field.accessor}
                      type="file"
                      accept="image/*"
                      onChange={handleChange}
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                );
              }

              // Add emballage select
              if (field.accessor === "emballage") {
                return (
                  <div key={field.accessor}>
                    <label
                      htmlFor={field.accessor}
                      className="block text-gray-700 font-medium mb-1"
                    >
                      Emballage
                    </label>
                    <select
                      id={field.accessor}
                      name={field.accessor}
                      value={values[field.accessor] || ""}
                      onChange={handleChange}
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                      disabled={!values.productId}
                    >
                      <option value="">Select emballage</option>
                      {emballages?.map((emb) => (
                        <option key={emb.id} value={emb.name}>
                          {emb.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div key={field.accessor}>
                  <label
                    htmlFor={field.accessor}
                    className="block text-gray-700 font-medium mb-1"
                  >
                    {field.label}
                  </label>
                  <input
                    id={field.accessor}
                    name={field.accessor}
                    type={field.type}
                    value={values[field.accessor]}
                    onChange={handleChange}
                    placeholder={
                      field.placeholder || `Enter ${field.label.toLowerCase()}`
                    }
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          {progress > 0 && progress < 100 && (
            <Progress value={progress} className="" />
          )}
          <button
            type="submit"
            className="mt-8 w-full bg-black text-white py-3 px-6 rounded-xl shadow-lg hover:bg-white hover:text-black border border-black transition"
          >
            {addbutton}
          </button>
        </form>

        {/* Confirmation dialog */}
        <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Commande confirmée !</AlertDialogTitle>
              <AlertDialogDescription>
                Votre commande a bien été enregistrée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowDialog(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default AddModal;
