import { ApiError } from "../utils/ApiError.js";
import { authRepository } from "../repositories/auth.repository.js";

// Authentication middleware — verifies apikey + token from headers/query.
const authMiddleware = (isPublic = false) => async (req, res, next) => {
    try {
        const apikey = req.headers.apikey || req.query.apikey;
        const token = req.headers.token || req.query.token;

        if (!apikey || !token) {
            if (isPublic) {
                req.isPublic = true;
                return next();
            }
            throw ApiError.unauthorized("apikey and token are required");
        }

        const authRecord = await authRepository.findByCredentials(apikey, token);

        if (!authRecord) {
            throw ApiError.unauthorized("Invalid apikey or token");
        }

        req._id = authRecord.user_id;
        req._role = authRecord.role;
        req.isPublic = false;

        next();
    } catch (error) {
        if (error instanceof ApiError) {
            return res.status(error.statusCode).json({
                s: 0,
                m: error.message,
                r: null,
                err: null,
            });
        }
        return res.status(500).json({
            s: 0,
            m: "Internal server error",
            r: null,
            err: error.message,
        });
    }
};

// Admin-only access middleware.
const adminOnly = (req, res, next) => {
    if (req._role !== 2) {
        return res.status(403).json({
            s: 0,
            m: "Insufficient privileges",
            r: null,
            err: null,
        });
    }
    next();
};

// User-or-admin access middleware.
const userOrAdmin = (req, res, next) => {
    if (req._role === 2) {
        return next();
    }
    next();
};

// User-only access middleware.
const userOnly = (req, res, next) => {
    next();
};

export { authMiddleware, adminOnly, userOrAdmin, userOnly };
