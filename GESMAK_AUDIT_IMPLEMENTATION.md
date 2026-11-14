# GESMAK — Audit et Suivi d'Implémentation (Harmonisation des Établissements)

Ce document répertorie l'état d'avancement, l'audit et le suivi des améliorations apportées aux quatre types d'établissements de la plateforme GESMAK :
1. **Maquis** (Modèle de référence)
2. **Restaurant**
3. **Complexe Hôtelier**
4. **Dépôt / Grossiste**

---

## 1. Inventaire Complet & État Initial

| Fonctionnalité | Maquis | Restaurant | Complexe Hôtelier | Dépôt / Grossiste | État Initial | État Actuel |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tableau de bord** | Opérationnel | Partiel | Opérationnel (Hôtel) | Partiel | Partiel | En cours d'harmonisation |
| **Ventes & Caisse** | Opérationnel | Partiel | Partiel | Partiel | Partiel | En cours d'harmonisation |
| **Gestion du Stock** | Opérationnel | Partiel | Partiel | Partiel (Manque unités gros) | Partiel | En cours d'harmonisation |
| **Achats & Fournisseurs**| Opérationnel | Opérationnel | Opérationnel | Opérationnel | Opérationnel | Opérationnel |
| **Dépenses** | Opérationnel | Opérationnel | Opérationnel | Opérationnel | Opérationnel | Opérationnel |
| **Employés & Rôles** | Opérationnel | Opérationnel | Opérationnel | Opérationnel | Opérationnel | Opérationnel |
| **Clients & Créances** | Opérationnel | Partiel | Opérationnel (Guests) | Opérationnel (Depot) | Partiel | En cours d'harmonisation |
| **Rapports & Stats** | Opérationnel | Partiel | Partiel | Partiel | Partiel | En cours d'harmonisation |
| **Modules Spécialisés** | Bar / Boissons | Menu / Cuisine / QR | Chambres / Réservations | Tournées / Consignes | Partiel | En cours d'optimisation |

---

## 2. Plan d'Action par Établissement

### A. Restaurant
- [x] Accès aux modules communs (Caisse, Stock, Achats, Dépenses, Employés, Clients).
- [ ] Harmonisation de la gestion des tables, de la carte, des menus et des commandes cuisine.
- [ ] Validation des flux de commande QR code et séparation claire de la caisse d'encaissement.

### B. Complexe Hôtelier
- [x] Tableau de bord hôtelier (`HotelDashboard`).
- [ ] Gestion des chambres, disponibilités, check-in / check-out.
- [ ] Consolidation multi-services (Chambres + Bar/Restaurant + Magasin) avec distinction des recettes.
- [ ] Nettoyage des routes et raccourcis obsolètes.

### C. Dépôt / Grossiste
- [x] Gestion des tournées, livraisons, créances, consignes et prix de gros (`DepotTours`, `DepotCreances`, `DepotConsignes`, `DepotPrices`).
- [ ] Amélioration de la gestion multi-unités (cartons, unités, palettes) dans le stock global.

---

## 3. Suivi des Fichiers Modifiés & Migrations
- Branche de travail : `feature/gesmak-harmonisation-etablissements`
- Fichiers mis à jour progressivement lors des phases 2, 3, 4 et 5.

---

## 4. Historique des Tests & Déploiement
- **Vérification TypeScript (`tsc --noEmit`) :** À lancer à chaque fin de phase.
- **Build Vite (`vite build`) :** À vérifier avant push.
- **Déploiement Vercel :** Vérification sur `https://gesmak.vercel.app` après merge sur `main`.
