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

        // Check if already following
        const alreadyFollower = await UserProfile.findOne({
            userId,
            "followers.userId": req.user._id,
        });

        if (alreadyFollower) {
            // Unfollow logic
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
                type: { $in: ["follow", "followrequest", "followaccept"] },
            });

            return res.status(200).json({
                action: "unfollowed",
                message: "User unfollowed successfully",
            });
        }

        // Check if there is a pending follow request
        const pendingRequest = await Update.findOne({
            actor: req.user._id,
            receiver: userId,
            type: "followrequest",
        });

        if (pendingRequest) {
            // Cancel the follow request
            await Update.deleteOne({ _id: pendingRequest._id });

            return res.status(200).json({
                action: "requested_cancelled",
                message: "Follow request cancelled",
            });
        }

        // Send a follow request
        await new Update({
            actor: req.user._id,
            receiver: userId,
            type: "followrequest",
        }).save();

        return res.status(200).json({
            action: "requested",
            message: "Follow request sent successfully",
            followMessage: `Follow request sent to ${username}`,
        });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
};

module.exports = { followUser };