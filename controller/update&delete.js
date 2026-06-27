const Uploadpost = require("../models/uploadpost");
const Update = require("../models/updates"); // Correct: updates.js (plural)
const { uploadToCloudinary, deleteFromCloudinary } = require("../service/cloudnary");

const deletePost = async (req, res) => {
  const { postId } = req.body;
  console.log("Delete attempt on post:", postId, "by user:", req.user.username);
  try {
    const post = await Uploadpost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Delete image from Cloudinary if it exists
    if (post.imageUrl && post.imageUrl.publicId) {
      try {
        await deleteFromCloudinary(post.imageUrl.publicId, post.imageUrl.resourceType || "image");
      } catch (deleteErr) {
        console.error("Failed to delete post image from Cloudinary on delete:", deleteErr);
      }
    }

    await Uploadpost.findByIdAndDelete(postId);

    const update = new Update({
      actor: req.user._id,
      receiver: req.user._id,
      type: "post",
    });

    await update.save();
    res.status(200).json({ message: "Deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

const updatePost = async (req, res) => {
  const { postId, title, content, status, tags, category } = req.body;
  
  let newImageUrl = null;
  if (req.file) {
    try {
      const uploadResult = await uploadToCloudinary(req.file.path, {
        folder: "blogsphere/post-images",
      });
      newImageUrl = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        resourceType: uploadResult.resourceType,
      };
    } catch (uploadErr) {
      console.error("Failed to upload new post image to Cloudinary:", uploadErr);
      return res.status(500).json({ error: "Failed to upload image to Cloudinary" });
    }
  }

  console.log("Update attempt on post:", postId, "by user:", req.user.username);

  try {
    const post = await Uploadpost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    let parsedTags = post.tags;
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        parsedTags = tags;
      } else if (typeof tags === "string") {
        try {
          parsedTags = JSON.parse(tags);
          if (!Array.isArray(parsedTags)) {
            parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
          }
        } catch (e) {
          parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }
    }

    const updateData = {
      title: title || post.title,
      content: content || post.content,
      status: status || post.status,
      category: category !== undefined ? category : post.category,
      tags: parsedTags
    };
    if (newImageUrl) {
      // Delete old post image from Cloudinary if it exists
      if (post.imageUrl && post.imageUrl.publicId) {
        try {
          await deleteFromCloudinary(post.imageUrl.publicId, post.imageUrl.resourceType || "image");
        } catch (deleteErr) {
          console.error("Failed to delete old post image from Cloudinary:", deleteErr);
        }
      }
      updateData.imageUrl = newImageUrl;
    }

    if (status === "draft") {
      updateData.likes = [];
      updateData.comments = [];
    }

    const updatedPost = await Uploadpost.findByIdAndUpdate(postId, updateData, {
      new: true,
    });

    const update = new Update({
      actor: req.user._id,
      receiver: req.user._id,
      type: "post",
    });

    await update.save();

    res.status(200).json({ message: "Updated", post: updatedPost });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { deletePost, updatePost };
