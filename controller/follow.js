const UserProfile = require("../models/userprofile");
const User = require("../models/user");
const Update = require("../models/updates");

const followUser = async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: "Username is required" });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userId = user._id;
        if (req.user._id.toString() === userId.toString()) {
            return res.status(400).json({ error: "You cannot follow yourself" });
        }

        const alreadyFollower = await UserProfile.findOne({
            userId,
            "followers.userId": req.user._id,
        });

        if (alreadyFollower) {
            await UserProfile.updateOne(
                { userId },
                { $pull: { followers: { userId: req.user._id } } },
            );

            await UserProfile.updateOne(
                { userId: req.user._id },
                { $pull: { following: { userId } } },
            );

            await Update.deleteMany({
                actor: req.user._id,
                receiver: userId,
                type: "follow",
            });

            return res.status(200).json({
                action: "unfollowed",
                message: "User unfollowed successfully",
            });
        }

        await UserProfile.updateOne(
            { userId },
            { $push: { followers: { userId: req.user._id, username: req.user.username } } },
        );

        await UserProfile.updateOne(
            { userId: req.user._id },
            { $push: { following: { userId, username } } },
        );

        await new Update({
            actor: req.user._id,
            receiver: userId,
            type: "follow",
        }).save();

        return res.status(200).json({
            action: "followed",
            message: "User followed successfully",
            followMessage: `You started following ${username}`,
        });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
};

module.exports = { followUser };