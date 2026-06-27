const UploadPost = require("../models/uploadpost");
const User = require("../models/user");
const UserProfile = require("../models/userprofile");

const getTrendingPosts = async (req, res) => {
    try {
        console.log("Trendings !!")
        const trendingPosts = await UploadPost.aggregate([
            {
                $addFields: {
                    LikeCount: { $size: "$likes" },
                    CommentCount: { $size: "$comments" },
                    savesCount: { $size: "$saves" },
                    trendingScore: {
                        $add: [
                            { $size: "$likes" },
                            { $multiply: [{ $size: "$comments" }, 3] },
                            { $multiply: [{ $size: "$saves" }, 5] }
                        ]
                    }
                }
            },
            {
                $sort: { trendingScore: -1 }
            }, {
                $limit: 5
            },
            {
                $project: {
                    _id: 1,
                    userId: 1,
                    username: 1,
                    title: 1,
                    content: 1,
                    imageUrl: 1,
                    createdAt: 1,
                },
            }
        ]);

        console.log(trendingPosts);
        const enrichedPosts = trendingPosts.map(post => {
            const rawImg = post.imageUrl;
            let imgUrlStr = rawImg && typeof rawImg === 'object' ? rawImg.url : rawImg;
            if (imgUrlStr && (imgUrlStr.startsWith("http://") || imgUrlStr.startsWith("https://"))) {
                imgUrlStr = `/uploads/${imgUrlStr}`;
            }
            return {
                ...post,
                imageUrl: imgUrlStr || ""
            };
        });
        res.status(200).json(enrichedPosts);
    }
    catch (err) {
        res.status(500).json({ message: "Server error" });
    }
}

const getTopAuthors = async (req, res) => {
    try {
        const topAuthors = await UploadPost.aggregate([
            {
                $group: {
                    _id: "$userId",
                    username: { $first: "$username" },

                    totalPosts: { $sum: 1 },

                    totalLikes: {
                        $sum: {
                            $size: "$likes"
                        }
                    }
                }
            },
            {
                $sort: {
                    totalPosts: -1,
                    totalLikes: -1
                }
            },
            {
                $limit: 5
            }
        ])
        console.log(topAuthors);
        const authorIds = topAuthors.map(author => author._id);
        console.log("Author IDs:", authorIds);
        const profiles = await UserProfile.find({
            userId: { $in: authorIds }
        });

        console.log("Profiles:", profiles);

        const authorsWithProfile = topAuthors.map(author => {
            const profile = profiles.find(p => p.userId.toString() === author._id.toString());
            return {
                ...author,
                userId: profile?.userId || author.userId,
                username: profile?.username || author.username,
                profilePicture: profile?.profilePicture || ''
            };
        });
        console.log("Authors with profile", authorsWithProfile);

        res.status(200).json(authorsWithProfile);
    }
    catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
}

const getPopularTags = async (req, res) => {
    try {
        const popularTags = await UploadPost.aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        res.status(200).json(popularTags);
    }
    catch (err) {
        res.status(500).json({ message: "Server Error" });
    }

}

module.exports = { getTrendingPosts, getTopAuthors, getPopularTags }