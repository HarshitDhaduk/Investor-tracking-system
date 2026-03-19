import { ApiError } from "./ApiError.js";

// Validates that all required fields are present and non-empty in the request. Throws ApiError if missing.
const validateRequest = (req, requiredFields = [], requiredFiles = []) => {
    const missing = [];
    const params = { ...req.body, ...req.params, ...req.query };

    for (const field of requiredFields) {
        if (
            !Object.prototype.hasOwnProperty.call(params, field) ||
            params[field] === null ||
            params[field] === undefined ||
            params[field] === ""
        ) {
            missing.push(field);
        }
    }

    for (const file of requiredFiles) {
        if (!req.files || !req.files[file]) {
            missing.push(file);
        }
    }

    if (missing.length > 0) {
        throw ApiError.badRequest(`Required : ${missing.join(" ")}`);
    }
};

export { validateRequest };
