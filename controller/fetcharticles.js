const express = require("express");
const axios = require("axios");

const router = express.Router();

router.get("/fetch-news", async (req, res) => {
  try {
    // Import model inside route handler to ensure mongoose is initialized
    const Article = require("../models/articles");
    
    const response = await axios.get("https://newsapi.org/v2/everything", {
      params: {
        q: "tesla",
        from: "2026-01-23",
        sortBy: "publishedAt",
        apiKey: "b7146859869747d693539d99fc383fd4",
      },
    });

    console.log("NewsAPI response received:", response.data);
    const articles = response.data.articles.map((article) => ({
      source: {
        id: article.source.id,
        name: article.source.name,
      },
      author: article.author,
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      content: article.content,
      publishedAt: article.publishedAt,
    }));

    console.log("Fetched articles from NewsAPI:", articles.length);


    // Insert new articles
    const createdArticles = await Article.insertMany(articles);

    console.log("Articles saved to DB successfully");

    res.status(200).json({
      message: "News fetched and saved successfully",
      count: createdArticles.length,
    });
  } catch (err) {
    console.error("Full error:", err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: "Validation error", details: messages });
    }
    if (err.code === 11000) {
      return res.status(400).json({ error: "Duplicate article URL" });
    }
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
