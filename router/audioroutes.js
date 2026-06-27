const express = require("express");
const router = express.Router();
const upload = require("../config/audiomulter");
const checkauthentication = require("../middleware/auth");
const { uploadToCloudinary } = require("../service/cloudnary");

router.post("/upload-audio", checkauthentication, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No audio file uploaded" });
  }
  try {
    const uploadResult = await uploadToCloudinary(req.file.path, {
      folder: "blogsphere/audio",
      resource_type: "video" // Cloudinary handles audio as video
    });
    
    return res.status(200).json({ 
      message: "Audio uploaded successfully", 
      audiourl: uploadResult.url 
    });
  } catch (err) {
    console.error("Audio upload failed:", err);
    return res.status(500).json({ message: "Error uploading audio" });
  }
});

module.exports = { router };