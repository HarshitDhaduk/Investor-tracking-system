# Architecture Overview: Clean Architecture & PostgreSQL

## 1. The Legacy Problem
Before the refactoring, the project suffered from tightly coupled code logic where controllers handled HTTP requests, executed complex business rules, and ran raw MySQL queries directly in the same file. 

## 2. The Clean Architecture Solution
The Morval Investments API now follows a strict 3-tier **Clean Architecture**:

- **Controller Layer (`src/controllers/`)**: The entry point. Extracts `req.body` or `req.params`, passes the payload strictly to the Service layer, and returns standardized JSON responses.
- **Service Layer (`src/services/`)**: The core business logic. Contains zero HTTP logic (no `req`/`res`). Executes algorithms, handles data transformations, and orchestrates multiple repositories. 
- **Repository Layer (`src/repositories/`)**: The data access layer. Extends `BaseRepository` to handle SQL database transactions using PostgreSQL. No business logic resides here.

### Interviwer Perspective & Potential Questions

**Q1: Why did you choose Clean Architecture over a standard MVC pattern?**
> **Expected Answer:** "MVC often leads to 'Fat Controllers' or 'Fat Models'. By introducing a distinct `Service` layer and `Repository` layer, we achieved true Separation of Concerns. This makes the codebase highly testable—I can mock the repository to unit test the business logic in the service without touching the database. It also makes swapping the DB engine (which we did from MySQL to PostgreSQL) much easier because SQL queries are isolated in the repositories."

**Q2: How do you handle database connections and cross-cutting concerns?**
> **Expected Answer:** "We use the `pg` library with a connection pool configured in `config/database.js`. All our repositories extend a `BaseRepository` class which contains unified wrapper methods (`select`, `selectOne`, `insert`, `update`) to handle parameterized queries automatically and mitigate SQL injection."

**Q3: How are dependencies managed across these layers?**
> **Expected Answer:** "We instantiate our services and repositories as singletons and export the instances (e.g., `export const authService = new AuthService();`). Services import repositories, and controllers import services. There are no circular dependencies because data flows strictly downwards."
