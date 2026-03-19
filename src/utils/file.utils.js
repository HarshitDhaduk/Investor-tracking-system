import path from "path";
import crypto from "crypto";

// Upload a file to the public/uploads directory.
const uploadFile = async (file, directory) => {
    try {
        if (!file) {
            return null;
        }
        const extension = path.extname(file.name);
        const fileName = crypto.randomBytes(16).toString("hex") + extension;
        const uploadPath = `./public/uploads/${directory}/${fileName}`;
        await file.mv(uploadPath);
        return `/uploads/${directory}/${fileName}`;
    } catch (err) {
        console.error("File upload error:", err.message);
        return null;
    }
};

export { uploadFile };
