# FarmLink — User Flows

## Flow 1 — Buyer
```mermaid
flowchart TD
  L[Landing] --> R[Register as buyer]
  R --> M[Browse /market + filter/search]
  M --> P[Product details]
  P --> C[Cart: adjust qty]
  C --> K[Checkout: address + fulfillment + COD/mock]
  K --> S[Order confirmation with number]
  S --> T[Track /orders/:id timeline]
```

## Flow 2 — Farmer
```mermaid
flowchart TD
  L[Landing] --> R[Register as seller]
  R --> O[Onboarding: farm profile]
  O --> V[Request verification]
  A[Admin approves] -.-> O
  O --> N[Add product]
  N --> M[Marketplace listing live]
  M --> IN[Incoming order]
  IN --> AC[Accept] --> ST[preparing → ready → dispatched/delivered]
```

## Flow 3 — Administrator
```mermaid
flowchart TD
  LI[Admin login] --> D[/admin dashboard]
  D --> RV[Review pending sellers]
  RV --> AP[Approve/Reject + audit log]
  AP --> MO[Moderate product active/suspended]
  MO --> MN[Monitor orders + audit history]
```

## Flow 4 — Returning user
```mermaid
flowchart TD
  LI[Login] --> D[Role dashboard]
  D --> P[Resume: pending orders / low stock / wishlist]
  P --> N[Notifications]
```
