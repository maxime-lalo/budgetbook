// --- Transaction Statuses ---

export const TRANSACTION_STATUSES = ["PENDING", "COMPLETED", "CANCELLED", "PLANNED"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

// --- Serialized entities (returned by server actions) ---

export type SerializedTransaction = {
  id: string;
  label: string;
  amount: number;
  date: string | null;
  month: number;
  year: number;
  status: TransactionStatus;
  note: string | null;
  accountId: string;
  categoryId: string | null;
  subCategoryId: string | null;
  bucketId: string | null;
  isAmex: boolean;
  recurring: boolean;
  sortOrder: number;
  destinationAccountId: string | null;
  account: { name: string; color: string | null } | null;
  destinationAccount: { name: string; color: string | null } | null;
  category: { name: string; color: string | null } | null;
  subCategory: { name: string } | null;
  bucket: { name: string } | null;
};

export type SerializedTransfer = {
  id: string;
  label: string;
  amount: number;
  date: string | null;
  month: number;
  year: number;
  status: TransactionStatus;
  note: string | null;
  accountId: string;
  categoryId: string | null;
  subCategoryId: string | null;
  bucketId: string | null;
  isAmex: boolean;
  destinationAccountId: string | null;
  account: { name: string; color: string | null; type: string } | null;
  destinationAccount: { name: string; color: string | null; type: string } | null;
  category: { name: string; color: string | null } | null;
  subCategory: { name: string } | null;
  bucket: { name: string } | null;
};

// --- Form data types (for dropdowns/selects) ---

export type FormAccount = {
  id: string;
  name: string;
  type: string;
  color?: string | null;
  buckets: { id: string; name: string }[];
  linkedCards?: { id: string; name: string }[];
};

export type FormCategory = {
  id: string;
  name: string;
  color?: string | null;
  subCategories: { id: string; name: string }[];
};
