# Budgets mensuels

## Fonctionnalités

### Navigation mensuelle
- Réutilise le composant `MonthNavigator` de transactions
- Paramètre URL `?month=2026-02`

### Résumé total (en haut de page)
Card avec 3 colonnes, affichée au-dessus de la grille si au moins un budget actif (budgeted > 0 ou spent > 0) :
- **Total budgété** : somme des budgets alloués
- **Total dépensé** (rouge) : somme des dépenses réelles
- **Total restant** (vert/rouge) : argent réellement disponible après engagements

**Calcul du Total restant :**
```
Total restant = carryOver + forecast − Σ max(budgété, dépensé) par catégorie
```
- `carryOver` = report cumulé des mois précédents via `getPreviousMonthBudgetRemaining()` (délègue à `getCarryOver()`)
- `forecast` = somme de toutes les transactions COMPLETED + PENDING du mois (via `getTransactionTotals`)
- Pour chaque catégorie active, on prend `max(budgété, dépensé)` — cela "réserve" le budget même s'il n'est pas encore consommé, et prend en compte les dépassements
- Si le carry-over est non nul, une ligne "dont report : X€" s'affiche sous le montant

**Exemple concret :**
- Revenus du mois : 3 606€ (forecast)
- Logement : budgété 850, dépensé 850 → engagé 850
- Alimentation : budgété 200, dépensé 0 → engagé 200 (réservé)
- Épargne : budgété 0, dépensé 1 500 → engagé 1 500 (dépassement)
- Total engagé : 2 694€
- **Total restant : 3 606 − 2 694 = 912€**

### Tableau de budgets (BudgetRow)
Affichage en tableau (pas de cards) avec une ligne par catégorie.

Chaque ligne affiche :
- **Catégorie** : pastille couleur + nom
- **Barre de progression** : largeur proportionnelle au % consommé
  - **Vert** : < 75% du budget consommé
  - **Jaune** : 75-100%
  - **Rouge** : ≥ 100% (dépassement), y compris le cas budget=0 avec dépenses > 0
  - Texte overlay : pourcentage
- **Budgété** : input numérique éditable inline (sauvegarde au blur via `upsertBudget()`)
- **Dépensé** : montant formaté ou "–"
- **Restant** : vert si positif, rouge si négatif, ou "–"
- **Fond rouge** (`red/10`) si dépassement

Note : `BudgetCard` existe encore dans le code mais n'est **plus utilisé** — remplacé par `BudgetRow` en tableau.

### Copie du mois précédent (CopyBudgetsButton)
- Bouton "Copier du mois précédent"
- Copie tous les budgets de M-1 vers le mois courant (upsert)
- Erreur si aucun budget au mois précédent

### Calibration des budgets (CalibrateBudgetsButton)
- Bouton "Calibrer les budgets" (icône `Scale`) affiché **uniquement** s'il y a au moins un dépassement (`spent > budgeted && spent > 0`)
- Au clic : ajuste chaque budget en dépassement = montant dépensé ; les budgets non dépassés restent intacts
- Placé juste au-dessus du tableau, à côté de CopyBudgetsButton
- Toast "X budget(s) calibré(s)" au succès

### Boutons d'action
Les boutons CopyBudgetsButton et CalibrateBudgetsButton sont positionnés juste au-dessus du tableau (pas dans le header).

## Server Actions (_actions/budget-actions.ts)

| Fonction | Description |
|----------|-------------|
| `getBudgetsWithSpent(year, month)` | Toutes les catégories avec budget du mois + dépenses réelles via `groupBy` |
| `upsertBudget(categoryId, year, month, amount)` | Création ou mise à jour d'un budget + `recomputeMonthlyBalance` |
| `copyBudgetsFromPreviousMonth(year, month)` | Copie les budgets de M-1 vers le mois courant + `recomputeMonthlyBalance` |
| `calibrateBudgets(year, month)` | Ajuste les budgets en dépassement = dépenses réelles + `recomputeMonthlyBalance` |

## Calcul des dépenses par catégorie

Les dépenses sont calculées via `db.select().groupBy()` (Drizzle) :
- Filtré par mois, statut `COMPLETED` ou `PENDING`
- Groupé par `categoryId`
- Le montant net est calculé, seules les catégories avec un total négatif comptent comme dépenses (`Math.abs`)
