# Clarification — Visibilité du forfait pour chaque abonné

**Date**: 2026-09-17  
**Input**: « Préciser pour chaque abonné son abonnement qu’il utilise et les propositions d’autres abonnements ; pour chaque client le forfait utilisé doit être clair. »

## Décisions

### C8 — Forfait actuel toujours explicite
Pour **chaque** établissement / client connecté, l’UI MUST afficher clairement :
- **Nom du forfait** en cours (Essentiel / Pro / Business)
- **Statut** (essai, actif, en retard, suspendu)
- **Dates** utiles (fin d’essai ou fin d’abonnement) si connues
- **Établissement** concerné (nom)

Lieux minimum :
- Paramètres → Abonnement
- Page `/subscription`
- (Optionnel) badge discret sur le dashboard / en-tête

### C9 — Autres forfaits proposés
À côté du forfait actuel, MUST lister les **autres offres** avec :
- Prix mensuel (et setup si pertinent)
- Limites clés (établissements, employés, produits, options Pro)
- Indication visuelle **« Votre forfait »** vs **« Changer / upgrader »**
- CTA paiement **WhatsApp / Mobile Money manuel** (pas CinetPay/Tiun en V1)

### C10 — Tous types d’établissement
C8 et C9 s’appliquent à **tous** les `business_type` (maquis, restaurant, dépôt, magasin, BTP, etc.).

## Acceptance

1. Given un client Essentiel, When Paramètres → Abonnement ou /subscription, Then « Essentiel » est visible comme forfait actuel et Pro/Business sont proposés.
2. Given un client Pro, When mêmes écrans, Then « Pro » est marqué actuel et Essentiel/Business sont listés (sans confusion).
3. Given absence temporaire d’établissement, Then message clair, pas d’écran vide.
