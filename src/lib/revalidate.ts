import { revalidatePath } from "next/cache";

export function revalidateTransactionPages() {
  revalidatePath("/transactions");
  revalidatePath("/transfers");
  revalidatePath("/savings");
}
