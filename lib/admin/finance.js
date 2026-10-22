export const EXPENSE_CATEGORIES = [
  { value: "INGREDIENTS", label: "Ingrédients & Matières premières", color: "#f97316" },
  { value: "SALAIRES", label: "Salaires & Personnel", color: "#3b82f6" },
  { value: "LOYER_CHARGES", label: "Loyer, Électricité & Eau", color: "#8b5cf6" },
  { value: "EQUIPEMENT", label: "Équipement & Matériel", color: "#06b6d4" },
  { value: "LIVRAISON", label: "Frais de Livraison & Transport", color: "#eab308" },
  { value: "MARKETING", label: "Marketing & Publicité", color: "#ec4899" },
  { value: "AUTRE", label: "Autres dépenses", color: "#64748b" },
];

export const VALID_EXPENSE_CATEGORIES = EXPENSE_CATEGORIES.map((c) => c.value);

export const toExpenseDto = (e) => ({
  id: e.id,
  amount: e.amount,
  description: e.description,
  category: e.category,
  categoryLabel: EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label || e.category,
  categoryColor: EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.color || "#64748b",
  date: e.date.toISOString(),
  createdAt: e.createdAt.toISOString(),
  updatedAt: e.updatedAt.toISOString(),
});

