const Message = require("./models/message");

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

    const result = await cloudinary.uploader.upload(req.file.path, {
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
      filePath: req.file.path,
      status: "sent"
    });

    return res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: result.url,
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