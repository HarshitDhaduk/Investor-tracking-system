---
description: Coding rules and conventions for this project
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

## CRUD Operations (Controller Skeleton Structure)

When writing controllers for CRUD operations, follow this consistent skeleton pattern across all projects.

### 1. Create (e.g., `createUser`)
**Steps:**
1. **Validate Requirements**: Use `validateRequest(req, ["field1", "field2"])` (or `verifyReq`) to check mandatory parameters.
2. **Handle Assets/Uploads**: Extract `req.body` and handle any file uploads (e.g., `profile_img`) using upload utilities.
3. **Pass to Service**: Pass the processed data to the service method.

### 2. Update (e.g., `updateUser`)
**Steps:**
1. **Validate Target Identifier**: Use `validateRequest(req, ["user_id"])` to ensure the unique identifier exists.
2. **Filter Allowed Fields**: Define an `allowedFields` array to prevent mass-assignment vulnerabilities. Only extract properties present in this array from `req.body`.
3. **Pass to Service**: Pass the filtered update payload and the `user_id` to the service.

### 3. Read Single (e.g., `getUserByID`)
**Steps:**
1. **Extract Identifier**: Retrieve the specific user details by its `user_id`.
2. **Fetch and Return**: Query the service for complete details by this ID.

### 4. Read Multiple (e.g., `getAllUsers`)
**Steps:**
1. **Extract Filters**: Use `req.query` (or `req.params` depending on routing) for extracting filters, search strings, specific IDs, and status.
2. **Pagination**: Extact offset/page variables. Default to offset-based pagination (e.g., `count`/`offset` and `limit`) unless cursor-based is specifically requested.
3. **Fetch List**: Pass filters and pagination configuration to the service.

### Skeleton Example Code

```javascript
import { someService } from "../../services/some.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { validateRequest } from "../../utils/validateRequest.js";

class SomeController {
    // POST /api/user/create
    createItem = catchAsync(async (req, res) => {
        validateRequest(req, ["name", "profile_img"]); // verifyReq params
        
        // Handle req.body and any upload logic using external utils here
        const result = await someService.createItem(req.body);
        return ApiResponse.success(res, result, "Item created successfully");
    });

    // PUT /api/user/update
    updateItem = catchAsync(async (req, res) => {
        validateRequest(req, ["user_id"]); // verifyReq params
        
        // allowedFields array to prevent unauthorized updates
        const allowedFields = ["name", "status"];
        const updateData = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        });

        const result = await someService.updateItem(req.body.user_id, updateData);
        return ApiResponse.success(res, result, "Item updated successfully");
    });

    // GET /api/user/by-id
    getItemByID = catchAsync(async (req, res) => {
        const userId = req.query.user_id; // Give details by user_id
        const result = await someService.getItemByID(userId);
        return ApiResponse.success(res, result, "Item details retrieved");
    });

    // GET /api/user/get-all
    getAllItems = catchAsync(async (req, res) => {
        // Use req.query (or param) for filters, ids, etc.
        const search = req.query.search || null;
        const status = req.query.status !== undefined ? parseInt(req.query.status) : null;
        
        // Use pagination (offset based by default)
        const count = req.query.count ? parseInt(req.query.count) : 0; // offset
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;

        const result = await someService.getAllItems({ search, status, count, limit });
        return ApiResponse.success(res, result, "Items retrieved successfully");
    });
}

const someController = new SomeController();
export { someController };
```

## Routing & Authentication

When creating new route files, organize endpoints logically and group authentication/authorization using `router.use` where possible.

### Middlewares
Our primary auth middlewares are imported from `src/middlewares/auth.middleware.js`:
- `authMiddleware()`: Secures routes by verifying the API key and token.
- `authMiddleware(true)`: Bypasses strict authentication (sets `req.isPublic = true` if tokens are absent). Useful for mixed-access routes.
- `adminOnly`: Restricts access to Admin roles only.
- `userOrAdmin`: Allows access to both Admin and standard Users.
- `userOnly`: Specific to standard Users.

### Skeleton Example Code

```javascript
import { Router } from "express";
import { someController } from "../controllers/some.controller.js";
import { authMiddleware, adminOnly, userOrAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// PUBLIC ROUTES
// Bypasses strict auth if tokens are missing (isPublic = true)
router.get("/public-list", authMiddleware(true), someController.getPublicList);
// Fully public without any middleware
router.post("/login", someController.login);

// AUTHENTICATED ROUTES
// Verify auth globally for all routes below this line
router.use(authMiddleware());

router.get("/profile", someController.getProfile);

// ROLE-SPECIFIC ROUTES (Inline)
// Apply role-based middleware to specific endpoints
router.post("/execute", userOrAdmin, someController.executeAction);

// ADMIN-ONLY ROUTES (Grouped)
// Restrict all following routes to Admins
router.use(adminOnly);

router.delete("/delete-item", someController.deleteItem);
router.put("/system-config", someController.updateConfig);

export default router;
```

## Database Guidelines

1. **Database Context**: Always clarify whether the current module uses **MySQL** or **PostgreSQL** based on the `config/database.js` or `config/flavour.js` file to apply the correct syntax and optimizations.

2. **Table Creation Standards**:
   - **Timestamps**: Every table must include `created_at` and `updated_at` columns.
     - *MySQL*: Use `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` for `updated_at`.
     - *PostgreSQL*: Create and bind a trigger function (e.g., `update_timestamp()`) to automatically manipulate the `updated_at` column upon row updates.
   - **Status & ENUM Flags**: For `status`, `role`, or `type` fields mapped as integers (e.g., `TINYINT` or `SMALLINT`), you **must** attach a clear comment specifying all enumerated values. 
     - *Example (MySQL)*: `status tinyint(1) NOT NULL DEFAULT '0' COMMENT '0: pending | 1: active'`
     - *Example (PostgreSQL)*: Annotate the schema with inline comments (e.g., `-- 0: pending | 1: active`) or use native PostgreSQL `COMMENT ON COLUMN`.

3. **Query Optimization & Performance Validation**:
   - For complex or large queries executing in controllers/services, verify index utilization.
   - Prevent executing queries that result in unstructured full table scans on large tables.
   - Formulate and run `EXPLAIN` / `EXPLAIN ANALYZE` against the query.
   - Ensure the query takes advantage of indexed paths by testing it against `INFORMATION_SCHEMA.STATISTICS` or viewing the query plan output for both MySQL and PostgreSQL.

## Postman Collection Guidelines

To maintain consistent and usable API documentation across projects, follow these rules when creating or updating Postman collections:

1. **Authentication & Environments**:
   - **Separate Environment Files**: Do not rely solely on collection variables. You **must** create explicit and separate Postman Environment export files (e.g., *[Collection Name] - LOCAL.postman_environment.json*, *DEV*, *PROD*).
   - These physical environment files must contain the base URL variables: `LOCAL_URL`, `DEV_URL`, `PROD_URL` (or map them into a dynamic `API_URL` variable), alongside empty auth fields like `apikey` and `token`. Users should select the target by switching the active Postman Environment (LOCAL, DEV, PROD) after importing.
   - For `signup` and `login` routes, inject a Postman Test Script to automatically parse the auth tokens from the response and set them as variables based on the authentication used in `auth.service.js` and `user_auth` related table in `database/*schema.sql`
   - Configure the collection or its specific folders to **"Inherit auth from parent"**, applying the extracted tokens globally to all authenticated endpoints.

2. **Request Payload**:
   - Default to using **form-data** for all request payloads unless specifically instructed otherwise.

3. **Folder Structure**:
   - Organize the collection strictly using a **controller-based** folder structure (e.g., Auth, Admin, User). Maintain endpoint groupings parallel to the routing files.

4. **GET Requests (Query Params)**:
   - For GET APIs, explicitly add all available variable options (e.g., search, pagination, limits) in the Postman **Params** tab, since those map to `req.params` or `req.query` in our routes.

5. **Descriptions & Rule Sets**:
   - **Required vs Optional**: Append `(Required)` or `(Optional)` to the description of *every* single field.
   - **ENUMs / States**: For fields like `status`, `type`, `role`, or structured filter fields, explicitly list out all applicable ENUM statuses/values in the description (e.g., `(Optional) 0: pending | 1: active`).
   - **Generic Fields**: Do not waste time writing verbose descriptive summaries for self-evident, generic fields like `name` or `description`. Only annotate them with their required constraints.