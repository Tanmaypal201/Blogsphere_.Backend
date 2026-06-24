const Article = require("../models/articles");

const CommentArticle = async (req, res) => {
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
    const post = await Article.findById(postId);
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

    res.status(200).json({ message: "Comment added successfully", post });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

const likeArticle = async (req, res) => {
  try {
    const { postId } = req.body;
    const username = req.user.username;
    console.log("Like attempt on post:", postId, "by user:", username);
    const post = await Article.findById(postId);
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
    
    res.status(200).json({ message: "Like updated successfully", post });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { CommentArticle, likeArticle };