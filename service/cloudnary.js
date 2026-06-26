const cloudinary = require("cloudinary");
const fs = require("fs");

const uploadonCloudnary = async (localFilePath, folder = "uploads") => {
    if (!localFilePath) return null;
    try {
        const uploadresults = await cloudinary.uploader.upload(localFilePath, { folder });
        console.log("uploaded");
        await fs.unlink(localFilePath);
        return {
            url: uploadresults.secure_url,
            public_id: uploadresults.public_id,
        };
    } catch (err) {
        await fs.unlink(localFilePath);
    }
};

module.exports = { uploadonCloudnary };