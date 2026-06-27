const Message = require("../models/message");
const User = require("../models/user");
const { uploadToCloudinary } = require("../service/cloudnary");

const uploadFileInMessageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    let type;
    let folder;
    let resourceType;

    if (req.file.mimetype.startsWith("image/")) {
      type = "image";
      folder = "blogsphere/chat-images";
      resourceType = "image";
    } else if (req.file.mimetype.startsWith("video/")) {
      type = "video";
      folder = "blogsphere/chat-videos";
      resourceType = "video";
    } else {
      type = "document";
      folder = "blogsphere/chat-documents";
      resourceType = "raw";
    }

    const uploadResult = await uploadToCloudinary(req.file.path, {
      folder,
      resource_type: resourceType,
    });

    if (!uploadResult) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload file to Cloudinary",
      });
    }

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      fileUrl: uploadResult.url,
      type: type,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });

  } catch (error) {
    console.error("Chat file upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { uploadFileInMessageController };