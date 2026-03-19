---
description: Coding rules and conventions for the Morval Investments project
---

# Coding Rules

## Comments
- **No section-divider comments.** Do not use decorative/separator comments like `// ─── SECTION NAME ──────` or `// ========= SECTION =========`. Let method names speak for themselves.
- **No JSDoc blocks.** Do not use `/** ... */` multi-line comment blocks. Use simple single-line `//` comments instead (e.g. `// Find a user by email and role with full profile data.`).
- Only use comments when they add value (explain *why*, not *what*).

## Architecture (Clean Code)
- **Services must never contain raw SQL.** All database queries must go through repository methods.
- **Controllers must be thin.** Extract → call service → respond. No business logic in controllers.
- **Repositories encapsulate all SQL.** If a new table or query pattern is needed, create or extend the appropriate repository.

## Formatting
- Use 4-space indentation consistently.
- Use ES module imports (`import`/`export`), no CommonJS.
