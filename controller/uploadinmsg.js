const Message = require("../models/Message");

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

    res.status(200).json({
      success: true,
      message: newMessage
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = { uploadFileInMessageController };