## Problem
The landing-page logo is using a `scale-[20]` CSS transform, which visually enlarges it far beyond the header bounds while keeping the DOM node small. The user wants the logo to sit naturally inside the header.

## Fix
1. **Remove the scale transform** from `BrandLogo` usage on the landing page (`src/routes/index.tsx`).
2. **Set a natural height** (`h-10` or `h-12`) on the `BrandLogo` component so it fits cleanly within the header padding (`py-4`).
3. **Audit other routes** (`auth.tsx`, `app-shell.tsx`, `verify.$code.tsx`) to ensure no other logo instances are using extreme scale transforms that overflow their containers.

No database or server-function changes needed — this is a pure frontend CSS/layout fix.