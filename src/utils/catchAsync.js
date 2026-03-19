// Wraps async route handlers — catches rejected promises and forwards to next().
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export { catchAsync };
