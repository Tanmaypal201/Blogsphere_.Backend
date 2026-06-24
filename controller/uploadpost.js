const UploadPost = require("../models/uploadpost");
const Update = require("../models/updates"); // Correct: updates.js (plural)

const createPost = async (req, res) => {
  try {
    const { title, content, status, category, tags } = req.body;
    const userId = req.user._id;

    console.log("Create post attempt:", req.body);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : "";

    let parsedTags = [];
    if (tags) {
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

    const newPost = new UploadPost({
      userId: userId,
      username: req.user.username,
      title,
      content,
      status,
      imageUrl,
      category: category || "",
      tags: parsedTags,
    });
    if (status === "draft") {
      newPost.likes = [];
      newPost.comments = [];
    }
    const result = await newPost.save();
    const update = new Update({
      actor: req.user._id,
      receiver: req.user._id,
      type: "post",
    });

    await update.save();
    res
      .status(201)
      .json({ message: "Post created successfully", post: result });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

const CommentPost = async (req, res) => {
  try {
    const { postId, comment } = req.body;
    console.log(
      "Comment attempt on post:",
      postId,
      "by user:",
      req.user.username,
      "Comment text:",
      comment,
    );
    const post = await UploadPost.findById(postId);
    console.log(
      "Commenting on post:",
      postId,
      "by user:",
      req.user.username,
      "Comment text:",
      comment,
    );
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    post.comments.push({
      user: req.user._id,
      username: req.user.username,
      text: comment,
    });
    await post.save();

    // Create notification if commenter is not the post author
    if (post.username !== req.user.username) {
      const update = new Update({
        actor: req.user._id,
        receiver: post.userId,
        type: "comment",
      });

      await update.save();
    }

    res.status(200).json({ message: "Comment added successfully", post });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

const likePost = async (req, res) => {
  try {
    const { postId } = req.body;
    const username = req.user.username;
    console.log("Like attempt on post:", postId, "by user:", username);
    const post = await UploadPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    const existingLike = post.likes.find((like) => like.username === username);
    if (existingLike) {
      post.likes = post.likes.filter((like) => like.username !== username);
    } else {
      post.likes.push({
        user: req.user._id,
        username: username,
      });
    }
    await post.save();

    // Notification for like only if it's a new like and not unliking, and also not liking own post
    if (!existingLike && post.username !== req.user.username) {
      const update = new Update({
        actor: req.user._id,
        receiver: post.userId,
        type: "like",
      });

      await update.save();
    }

    res.status(200).json({ message: "Like updated successfully", post });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

const savepost = async (req, res) => {
  try {
    const { postId } = req.body;
    const user = req.user._id;
    const username = req.user.username;
    const post = await UploadPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    const existsavepost = post.saves.find((save) => save.username === username);
    if (existsavepost) {
      post.saves = post.saves.filter((save) => save.username !== username);
    } else {
      post.saves.push({
        user: user,
        username: username,
      });
    }
    await post.save();

    const UserProfile = require("../models/userprofile");
    const authorProfile = await UserProfile.findOne({ username: post.username });

    res.status(200).json({
      message: "Succesfully Done !!",
      post: {
        ...post.toObject(),
        profilePicture: authorProfile?.profilePicture || null,
      }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};



module.exports = { createPost, CommentPost, likePost, savepost };
