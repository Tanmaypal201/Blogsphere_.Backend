const express = require("express");
const router = express.Router();
const upload = require("../config/audiomulter");
const checkauthentication = require("../middleware/auth");
const { uploadonCloudnary } = require("../service/cloudnary");

router.post("/upload-audio", checkauthentication, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No audio file uploaded" });
  }
  try {
    const uploadresults = await uploadonCloudnary(req.file.path);
    return res.status(200).json({ message: "Audio uploaded successfully", audiourl: uploadresults.url });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Error uploading audio" });
  }
});

module.exports = { router };