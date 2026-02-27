import { db, accounts, categories, subCategories, appPreferences } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@/lib/logger";

const DEFAULT_CATEGORIES = [
  { name: "Logement", color: "#6366f1", icon: "Home", subs: ["Loyer", "Charges", "Assurance habitation", "Travaux"] },
  { name: "Alimentation", color: "#22c55e", icon: "ShoppingCart", subs: ["Courses", "Restaurant", "Livraison"] },
  { name: "Transport", color: "#f59e0b", icon: "Car", subs: ["Essence", "Transports en commun", "Parking", "Péage", "Entretien véhicule"] },
  { name: "Santé", color: "#ef4444", icon: "Heart", subs: ["Médecin", "Pharmacie", "Mutuelle"] },
  { name: "Loisirs", color: "#8b5cf6", icon: "Gamepad2", subs: ["Sorties", "Sport", "Vacances", "Culture"] },
  { name: "Shopping", color: "#ec4899", icon: "ShoppingBag", subs: ["Vêtements", "Électronique", "Maison"] },
  { name: "Abonnements", color: "#06b6d4", icon: "Repeat", subs: ["Streaming", "Téléphone", "Internet", "Presse"] },
  { name: "Éducation", color: "#14b8a6", icon: "GraduationCap", subs: ["Formation", "Livres"] },
  { name: "Impôts & Taxes", color: "#64748b", icon: "Landmark", subs: ["Impôt sur le revenu", "Taxe foncière", "Taxe habitation"] },
  { name: "Épargne", color: "#10b981", icon: "PiggyBank", subs: ["Livret A", "Assurance vie", "PEA", "Crypto"] },
  { name: "Revenus", color: "#059669", icon: "Banknote", subs: ["Salaire", "Prime", "Freelance", "Dividendes"] },
  { name: "Remboursements", color: "#0ea5e9", icon: "RotateCcw", subs: ["Sécurité sociale", "Mutuelle", "Employeur"] },
  { name: "Cadeaux", color: "#f43f5e", icon: "Gift", subs: ["Offerts", "Reçus"] },
  { name: "Divers", color: "#78716c", icon: "MoreHorizontal", subs: ["Frais bancaires", "Autre"] },
];

export async function seedUserDefaults(userId: string): Promise<void> {
  // Catégories par défaut avec sous-catégories
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const cat = DEFAULT_CATEGORIES[i];
    const catId = createId();
    await db.insert(categories).values({
      id: catId,
      userId,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      sortOrder: i,
    });

    for (let j = 0; j < cat.subs.length; j++) {
      await db.insert(subCategories).values({
        id: createId(),
        userId,
        name: cat.subs[j],
        categoryId: catId,
        sortOrder: j,
      });
    }
  }

  // Comptes par défaut
  await db.insert(accounts).values({
    id: createId(),
    userId,
    name: "Compte Courant",
    type: "CHECKING",
    color: "#3b82f6",
    icon: "Wallet",
    sortOrder: 0,
  });

  await db.insert(accounts).values({
    id: createId(),
    userId,
    name: "Livret A",
    type: "SAVINGS",
    color: "#10b981",
    icon: "PiggyBank",
    sortOrder: 1,
  });

  // Préférences par défaut
  await db.insert(appPreferences).values({
    id: createId(),
    userId,
    amexEnabled: true,
    separateRecurring: true,
  });

  logger.info("User defaults seeded", { userId });
}
