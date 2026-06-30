const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const parseCloudinaryUrl = (urlStr) => {
  if (!urlStr || typeof urlStr !== "string") return null;

  try {
    const url = new URL(urlStr);
    if (!url.hostname.includes("cloudinary.com")) return null;
    const parts = url.pathname.split("/");
    const resourceType = parts[2];
    let startIndex = 4;
    if (parts[startIndex] && parts[startIndex].startsWith("v") && /^\d+$/.test(parts[startIndex].substring(1))) {
      startIndex = 5;
    }

    const publicIdWithExt = parts.slice(startIndex).join("/");
    const extIndex = publicIdWithExt.lastIndexOf(".");
    const publicId = extIndex !== -1 ? publicIdWithExt.substring(0, extIndex) : publicIdWithExt;

    return {
      publicId,
      resourceType,
    };
  } 
  catch (e) {
    return null;
  }
};

const uploadToCloudinary = async (localFilePath, options = {}) => {
  if (!localFilePath) {
    throw new Error("No file path provided for Cloudinary upload");
  }
  try {
    const uploadResult = await cloudinary.uploader.upload(localFilePath, options);
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (unlinkErr) {
      console.error(`Failed to delete temporary local file: ${localFilePath}`, unlinkErr);
    }
    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      resourceType: uploadResult.resource_type,
    };
  } catch (error) {
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (unlinkErr) {
      console.error(`Failed to delete temporary local file on error: ${localFilePath}`, unlinkErr);
    }
    console.error("Cloudinary upload failed:", error);
    throw error;
  }
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return null;
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || "image",
    });
    return result;
  } catch (error) {
    console.error(`Failed to delete file from Cloudinary (publicId: ${publicId}):`, error);
    throw error;
  }
};

const uploadonCloudnary = async (localFilePath, options = "uploads") => {
  const uploadOptions = typeof options === "string" ? { folder: options } : options;
  return uploadToCloudinary(localFilePath, uploadOptions);
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadonCloudnary,
  parseCloudinaryUrl,
};