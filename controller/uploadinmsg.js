const Message = require("../models/message");
const { uploadonCloudnary } = require("../service/cloudnary");

const uploadFileInMessageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const { senderId, receiverId } = req.body;

    let type;
    if (req.file.mimetype.startsWith("image/")) {
      type = "image";
    } else if (req.file.mimetype.startsWith("video/")) {
      type = "video";
    } else {
      type = "document";
    }

    const uploadresult = await uploadonCloudnary(req.file.path, {
      folder: "chat_files",
      resource_type: type === "image" ? "image" : type === "video" ? "video" : "raw",
    });

    const newMessage = await Message.create({
      sender: {
        userId: senderId
      },
      receiver: {
        userId: receiverId
      },
      type,
      fileName: req.file.originalname,
      filePath: uploadresult.secure_url,
      status: "sent"
    });

    return res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: uploadresult.secure_url,
      type: type,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = { uploadFileInMessageController };