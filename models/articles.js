const mongoose = require("mongoose");

const articleSchema = new mongoose.Schema(
  {
    source: {
      id: String,
      name: String,
    },

    author: String,
    title: String,
    description: String,

    url: {
      type: String,
      unique: true,
      required: true,
    },

    urlToImage: String,
    publishedAt: Date,
    content: String,

    // ❤️ Likes
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        username: {
          type: String,
        },
      },
    ],

    // 💬 Comments
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        username: {
          type: String,
        },
        text: {
          type: String,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Article = mongoose.model("Article", articleSchema);

module.exports = Article;