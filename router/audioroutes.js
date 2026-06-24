const express=require("express");
const router=express.Router();
const upload = require("../config/audiomulter");
const checkauthentication=require("../middleware/auth");

router.post("/upload-audio",checkauthentication,upload.single("audio"),(req,res)=>{
    if(!req.file){
        return res.status(400).json({message:"No audio file uploaded"});
    }

    const normalizedPath = String(req.file.path || "").replace(/\\/g, "/");
    const relativeUploadPath = normalizedPath.includes("uploads/")
      ? normalizedPath.slice(normalizedPath.indexOf("uploads/"))
      : normalizedPath;
    const audiourl = `/${relativeUploadPath.replace(/^\/+/, "")}`;
    return res.status(200).json({message:"Audio uploaded successfully",audiourl, audioUrl: audiourl});
});

router.post("/upload-img-message",checkauthentication,upload.single("image"),(req,res)=>{
    if(!req.file){
        return res.status(400).json({message:"No image file uploaded"});
    }
    const normalizedPath = String(req.file.path || "").replace(/\\/g, "/");
    const relativeUploadPath = normalizedPath.includes("uploads/")
      ? normalizedPath.slice(normalizedPath.indexOf("uploads/"))
      : normalizedPath;
    const imageurl = `/${relativeUploadPath.replace(/^\/+/, "")}`;
    return res.status(200).json({message:"Image uploaded successfully",imageurl, imageUrl: imageurl});
}); 


module.exports={router};