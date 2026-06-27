const Message = require("../models/message");
const User = require("../models/user");
const { uploadToCloudinary } = require("../service/cloudnary");

const uploadFileInMessageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const { senderId, receiverId } = req.body;
    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: "Sender ID and Receiver ID are required"
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
        message: "Failed to upload file to Cloudinary"
      });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    const newMessage = await Message.create({
      sender: {
        userId: senderId,
        username: sender?.username || "Unknown"
      },
      receiver: {
        userId: receiverId,
        username: receiver?.username || "Unknown"
      },
      content: req.file.originalname || "Sent a file",
      type,
      fileName: req.file.originalname,
      fileUrl: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        resourceType: uploadResult.resourceType
      },
      fileSize: req.file.size,
      status: "sent"
    });

    return res.status(200).json({
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
      message: error.message
    });
  }
};

module.exports = { uploadFileInMessageController };