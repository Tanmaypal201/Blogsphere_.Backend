require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3001;
const { connectDB } = require("./connection");
const cloudinary = require("cloudinary").v2;
const authRoutes = require("./router/authroutes");
const audioRoutes = require("./router/audioroutes");
const uploadmsgroutes = require("./router/uploadmsgroutes");
const Message = require("./models/message");
const passport = require("./config/passwordconfig");
const { getTrendingPosts, getPopularTags, getTopAuthors } = require("./controller/gettrendings");
const {
  userController,
  loginController,
  verifyController,
} = require("./controller/user");
const cookieParser = require("cookie-parser");
const checkauthentication = require("./middleware/auth");
const { setprofile } = require("./controller/userprofile");
const User = require("./models/user");
const UserProfile = require("./models/userprofile");
const UploadPost = require("./models/uploadpost");
const path = require("path");
const {
  uploadProfilePicture,
  uploadPostImage,
  uploadImageinmessage,
  uploadVideoInMessage,
  uploadDocumentInMessage
} = require("./middleware/uploadfile");
const { createPost, CommentPost, savepost, likePost } = require("./controller/uploadpost");
const { deletePost, updatePost } = require("./controller/update&delete");
const { getUpdates } = require("./controller/getupdates");
const { setsettings } = require("./controller/settings");
const { CommentArticle, likeArticle } = require("./controller/comment&likeart");
const { followUser } = require("./controller/follow");
const Article = require("./models/articles");
const http = require("http");

// Socket.io: only initialize when running as a regular Node server (not Vercel serverless)
const server = http.createServer(app);
try {
  const { initializeSocket } = require("./socket");
  initializeSocket(server);
} catch (e) {
  console.warn("Socket.io initialization skipped:", e.message);
}

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
let dbConnected = false;
async function ensureDB() {
  if (!dbConnected) {
    await connectDB(process.env.MONGODB_URI);
    dbConnected = true;
    console.log("Connected to database");
  }
}
app.use(async (req, res, next) => {
  try {
    await ensureDB();
    next();
  } catch (err) {
    console.error("DB connection error:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Redirect /uploads/https:/... or /uploads/http:/... to the actual Cloudinary URL
app.use((req, res, next) => {
  const match = req.path.match(/^\/uploads\/(https?):\/+(.*)/);
  if (match) {
    const protocol = match[1];
    const rest = match[2];
    const targetUrl = `${protocol}://${rest}`;
    return res.redirect(targetUrl);
  }
  next();
});

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", audioRoutes.router);
app.use("/auth", authRoutes);
app.use("/uploadMessage", uploadmsgroutes.router);
app.post("/signup", userController);
app.post("/login", loginController);
app.post("/verify", verifyController);
app.get("/profile", checkauthentication, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.json({ user });
});

app.get("/profileget", checkauthentication, async (req, res) => {
  console.log("Profile get request for user:", req.user.username);
  const user = await UserProfile.findOne({ userId: req.user._id });
  console.log(
    "Profile get attempt for user:",
    req.user.username,
    "Profile found:",
    user,
  );
  res.json({ user });
});

app.get("/download/:filename", checkauthentication, async (req, res, next) => {
  const fileName = req.params.filename;
  const originalName = req.query.name || fileName;
  const filePath = path.join(__dirname, "uploads", fileName);
  console.log("FileName on disk:", fileName);
  console.log("OriginalName client:", originalName);
  console.log("FilePath target:", filePath);
  const fs = require("fs");
  if (fs.existsSync(filePath)) {
    return res.download(filePath, originalName, (err) => {
      if (err) {
        console.error("Local download error:", err);
        if (!res.headersSent) {
          res.status(404).json({ error: "File not found" });
        }
      }
    });
  }
  try {
    const https = require("https");
    let fileUrl = "";
    const fileRegex = new RegExp(fileName + "$", "i");
    const msg = await Message.findOne({
      $or: [
        { "fileUrl.url": fileRegex },
        { fileUrl: fileRegex },
        { content: fileRegex }
      ]
    });

    if (msg) {
      fileUrl = msg.fileUrl && typeof msg.fileUrl === 'object' ? msg.fileUrl.url : msg.fileUrl || msg.content;
    }
    if (!fileUrl) {
      const profile = await UserProfile.findOne({
        $or: [
          { "profilePicture.url": fileRegex },
          { profilePicture: fileRegex }
        ]
      });
      if (profile) {
        fileUrl = profile.profilePicture && typeof profile.profilePicture === 'object' ? profile.profilePicture.url : profile.profilePicture;
      }
    }
    if (!fileUrl) {
      const post = await UploadPost.findOne({
        $or: [
          { "imageUrl.url": fileRegex },
          { imageUrl: fileRegex }
        ]
      });
      if (post) {
        fileUrl = post.imageUrl && typeof post.imageUrl === 'object' ? post.imageUrl.url : post.imageUrl;
      }
    }

    if (!fileUrl) {
      console.warn("File URL not found in DB for filename:", fileName);
      return res.status(404).json({ error: "File not found" });
    }

    console.log("Streaming file from Cloudinary:", fileUrl);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(originalName)}"`);
    https.get(fileUrl, (cloudinaryRes) => {
      if (cloudinaryRes.statusCode !== 200) {
        console.error("Cloudinary returned status:", cloudinaryRes.statusCode);
        return res.status(cloudinaryRes.statusCode).json({ error: "Storage file download failed" });
      }

      if (cloudinaryRes.headers["content-type"]) {
        res.setHeader("Content-Type", cloudinaryRes.headers["content-type"]);
      }
      if (cloudinaryRes.headers["content-length"]) {
        res.setHeader("Content-Length", cloudinaryRes.headers["content-length"]);
      }

      cloudinaryRes.pipe(res);
    }).on("error", (err) => {
      console.error("Cloudinary stream request error:", err);
      res.status(500).json({ error: "Failed to download file from storage" });
    });

  } catch (err) {
    console.error("DB download lookup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

const getFileUrl = (field) => {
  if (!field) return "";
  const url = typeof field === "object" ? field.url : field;
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    return url;
  }
  return url ? `/uploads/${url}` : "";
};

app.post("/setprofile", checkauthentication, uploadProfilePicture, setprofile);
app.post("/createpost", checkauthentication, uploadPostImage, createPost);
app.post("/setsettings", checkauthentication, setsettings);
app.post("/savepost", checkauthentication, savepost);

app.get("/getposts", checkauthentication, async (req, res) => {
  try {
    const posts = await UploadPost.find({ username: req.user.username }).sort({
      createdAt: -1,
    });
    res.json({ posts });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getsavedposts", checkauthentication, async (req, res) => {
  try {
    const posts = await UploadPost.find({
      "saves.user": req.user._id
    }).sort({ createdAt: -1 });

    const userIds = posts.map(post => post.userId);

    const profiles = await UserProfile.find({
      userId: { $in: userIds }
    }).select("userId profilePicture");

    const profileMap = {};

    profiles.forEach(profile => {
      profileMap[profile.userId.toString()] = getFileUrl(profile.profilePicture);
    });

    const postsWithProfile = posts.map(post => ({
      ...post.toObject(),
      profilePicture: profileMap[post.userId.toString()] || ""
    }));
    console.log("saved posts with profile", postsWithProfile);
    res.json({ posts: postsWithProfile });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getTrendingPosts", checkauthentication, getTrendingPosts);
app.get("/getPopularTags", checkauthentication, getPopularTags);
app.get("/getTopAuthors", checkauthentication, getTopAuthors);


app.post("/getfollowingposts", checkauthentication, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "User ID is required" });
    }
    console.log("Get following posts attempt for userId:", id);
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    console.log(
      "User found for following posts:",
      user._id,
      "with userId:",
      id,
    );
    const targetUserId = user._id;
    const postofuser = await UploadPost.find(
      { username: user.username, status: { $ne: "draft" } }
    ).sort({
      createdAt: -1,
    });
    const { followers, following } = await UserProfile.findOne({
      userId: targetUserId,
    }).select("following followers");
    res.status(200).json({
      followers: followers,
      following: following,
      posts: postofuser.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getuserposts/:id", checkauthentication, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const posts = await UploadPost.find({ username: user.username }).sort({
      createdAt: -1,
    });
    res.json({ posts });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getallarticles", checkauthentication, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const articles = await Article.find({}).skip(skip).limit(limit);

    const total = await Article.countDocuments();

    res.json({
      articles,
      hasMore: skip + articles.length < total,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getuserprofile/:id", checkauthentication, async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await UserProfile.findOne({ userId: id }).select(
      "-password",
    );
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: profile });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getallposts", checkauthentication, async (req, res) => {
  try {
    const posts = await UploadPost.find({ status: "published" }).sort({
      createdAt: -1,
    });
    const postsWithProfiles = await Promise.all(
      posts.map(async (post) => {
        const userProfile = await UserProfile.findOne({
          username: post.username,
        });
        return {
          ...post.toObject(),
          profilePicture: getFileUrl(userProfile?.profilePicture) || null,
        };
      }),
    );

    res.json({ posts: postsWithProfiles });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/getallusers", checkauthentication, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(400).json({ error: "User not authenticated" });
    }
    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true
    }).select("_id username email");

    const profiles = await UserProfile.find({
      userId: { $in: users.map((u) => u._id) },
    }).select("userId profilePicture");

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.userId.toString()] = getFileUrl(profile.profilePicture);
    });

    const usersWithProfilePics = await Promise.all(
      users.map(async (user) => {
        const lastMsg = await Message.findOne({
          $or: [
            { "sender.userId": req.user._id, "receiver.userId": user._id },
            { "sender.userId": user._id, "receiver.userId": req.user._id },
          ],
        }).sort({ createdAt: -1 });

        const unseenCount = await Message.countDocuments({
          "sender.userId": user._id,
          "receiver.userId": req.user._id,
          status: { $ne: "seen" },
        });

        return {
          _id: user._id,
          username: user.username,
          email: user.email,
          profilePicture: profileMap[user._id.toString()] || null,
          lastMessage: lastMsg
            ? {
              content: lastMsg.content,
              type: lastMsg.type,
              createdAt: lastMsg.createdAt,
              status: lastMsg.status,
            }
            : null,
          unreadCount: unseenCount,
        };
      })
    );
    res.json({ users: usersWithProfilePics });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/messages/:userId", checkauthentication, async (req, res) => {
  try {
    const senderuserId = req.user._id;
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const receiverUserId = user._id;
    const messages = await Message.find({
      $or: [
        { "sender.userId": senderuserId, "receiver.userId": receiverUserId },
        { "sender.userId": receiverUserId, "receiver.userId": senderuserId },
      ],
    }).sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/getupdates", checkauthentication, getUpdates);
app.post("/commentpost", checkauthentication, CommentPost);
app.post("/likepost", checkauthentication, likePost);
app.post("/followuser", checkauthentication, followUser);
app.post("/commentarticle", checkauthentication, CommentArticle);
app.post("/likearticle", checkauthentication, likeArticle);
app.post("/deletepost", checkauthentication, deletePost);
app.post("/updatepost", checkauthentication, uploadPostImage, updatePost);

app.post("/logout", checkauthentication, async (req, res) => {
  res.clearCookie("token",
    { httpOnly: true, secure: true, sameSite: "None" });
  console.log(`User ${req.user.username} logged out`);
  return res.status(200).json({ message: "Logout successful" });
});

if (require.main === module) {
  connectDB(process.env.MONGODB_URI)
    .then(() => {
      console.log("Connected to database");
      server.listen(PORT, () => {
        console.log(`Server with socket is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.log(err);
      process.exit(1);
    });
}

// Centralized Error Handling Middleware (handles Multer & General errors)
app.use((err, req, res, next) => {
  console.error("Centralized Error Handler:", err);

  const multer = require("multer");
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
      code: err.code
    });
  }

  if (err.message && (err.message.includes("allowed") || err.message.includes("type"))) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

module.exports = app;
