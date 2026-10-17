# Verifinder UI & Coding Design System Guidelines

This document outlines the design standards and conventions for the Verifinder project. All agents and developers must strictly adhere to these rules.

---

## 1. Core Visual Design Standards

* **Base Background**: `#f1f5f9` (clean cool slate background).
* **Card Style**: Pure white cards (`bg-white`) with subtle border (`border border-slate-200/90`), subtle shadow (`shadow-xs` or `shadow-sm`), and **12px to 14px border radius** (`rounded-[14px]`).
* **Strict Border Radius Limit**:
  * **Buttons, Badges, Inputs**: Strictly **10px** border radius (`rounded-[10px]`).
  * **Cards & Containers**: Strictly **12px–14px** border radius (`rounded-[12px]` / `rounded-[14px]`).
  * **Never** use excessive 9999px pill containers or mismatched border radiuses.
* **Primary Color Palette**:
  * Primary Blue: `#2563eb` (Hover `#1d4ed8`)
  * Neutral Dark (Headings): `#0f172a` / `#1e293b`
  * Neutral Muted (Subtitles): `#64748b` / `#94a3b8`
  * Border Tone: `#e2e8f0` / `border-slate-200`
  * Success Emerald: `#10b981` (Badges: `#ecfdf5` text `#047857`)

---

## 2. Graphics & Image Presentation (No Double Boxes)

* **Clean Direct Rendering**:
  * Render illustrations (e.g., `1_41.jpg`, `Login.png`) directly on the white card background.
  * **Do NOT** wrap images in nested bordered gray boxes, extra paddings, or nested shadows.
  * Reusable class in `styles.css`: `.platform-graphic` (`max-w-[260px] w-full object-contain`).
* **QR Code Display**:
  * Render QR codes with a single clean white box (`.qr-display-box` or `bg-white p-3 rounded-[12px] border border-slate-200`).
  * Do not nest inside multiple background containers.

---

## 3. Sidebar Navigation Guidelines

* **Active Item**:
  * Subtle blue container: `bg-blue-50 text-blue-600 font-semibold border border-blue-100 rounded-[10px]`.
  * **No yellow or mismatched accent colors**.
* **Inactive Items**:
  * Transparent background, `text-slate-600 font-medium`, subtle hover `hover:bg-slate-100/80 hover:text-slate-900 rounded-[10px]`.
* **Collapsible**: Smooth width transition (`w-60` expanded, `w-[70px]` collapsed) with Angular Material `matTooltip`.

---

## 4. Copywriting & Language Rules

* **Plain, Natural English Only**:
  * Write copy from a customer's perspective.
  * Never expose backend implementation jargon (avoid: *"Baileys multi-device socket"*, *"MongoDB persistence"*, *"jitter cooldown"*, etc.).
  * Use clear, simple instructions:
    * *"Connect Your WhatsApp"*
    * *"Scan the QR code with your phone"*
    * *"Connected with +91XXXXXXXX"*
    * *"Send Verification Code (OTP)"*

---

## 5. Reusable Component Classes (from `src/styles.css`)

* **Cards**: `.platform-card`
* **Buttons**:
  * Primary: `.btn-primary`
  * Secondary: `.btn-secondary`
  * Danger Outline: `.btn-danger-outline`
* **Form Inputs**: `.input-control`
* **Graphics**: `.platform-graphic`
* **QR Display**: `.qr-display-box`
