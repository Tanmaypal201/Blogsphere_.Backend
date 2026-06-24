const Uploadpost = require("../models/uploadpost");
const Update = require("../models/updates"); // Correct: updates.js (plural)

const deletePost = async (req, res) => {
  const { postId } = req.body;
  console.log("Delete attempt on post:", postId, "by user:", req.user.username);
  try {
    const post = await Uploadpost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
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
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";
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
    if (imageUrl) updateData.imageUrl = imageUrl;

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
