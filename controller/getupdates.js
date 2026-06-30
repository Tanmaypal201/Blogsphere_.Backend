const Update = require("../models/updates");
const UserProfile = require("../models/userprofile");

const getUpdateContent = (type, actorUsername, isOwnUpdate) => {
  if (isOwnUpdate) {
    switch (type) {
      case "like":
        return `You liked a post`;
      case "comment":
        return `You commented on a post`;
      case "post":
        return `You published a new post`;
      case "profile":
        return `You updated your profile`;
      case "follow":
        return `You started following ${actorUsername}`;
      case "followrequest":
        return `You sent a follow request to ${actorUsername}`;
      case "followaccept":
        return `You accepted the follow request from ${actorUsername}`;
      default:
        return `You sent an update`;
    }
  } else {
    switch (type) {
      case "like":
        return `${actorUsername} liked your post`;
      case "comment":
        return `${actorUsername} commented on your post`;
      case "post":
        return `${actorUsername} published a new post`;
      case "profile":
        return `${actorUsername} updated their profile`;
      case "follow":
        return `${actorUsername} started following you`;
      case "followrequest":
        return `${actorUsername} sent you a follow request`;
      case "followaccept":
        return `${actorUsername} accepted your follow request`;
      default:
        return `${actorUsername} sent an update`;
    }
  }
};

const getUpdates = async (req, res) => {
  try {
    const updates = await Update.find({ receiver: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (updates.length === 0) {
      return res.status(200).json({ updates: [] });
    }
    if (updates[0].receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized access to updates" });
    }

    const actorIds = updates.map((u) => u.actor);

    const profiles = await UserProfile.find({
      userId: { $in: actorIds },
    }).lean();

    const profileMap = new Map(
      profiles.map((profile) => [profile.userId.toString(), profile]),
    );

    const currentUserId = req.user._id.toString();

    const enrichedUpdates = updates.map((update) => {
      const actorId = update.actor?.toString();
      const receiverId = update.receiver?.toString();
      const isOwnUpdate = actorId === receiverId;
      if ((update.type === "like" || update.type === "comment") && isOwnUpdate) {
        return null;
      }

      const actorProfile = actorId ? profileMap.get(actorId) : null;
      const actorUsername = actorProfile?.username || "Someone";
      const rawProfilePic = actorProfile?.profilePicture;
      const profilePicStr = rawProfilePic && typeof rawProfilePic === 'object' ? rawProfilePic.url : rawProfilePic;
      const profilePicUrl = profilePicStr ?
        (profilePicStr.startsWith('http') ?
          profilePicStr :
          `http://localhost:3001${profilePicStr}`) :
        "";

      return {
        ...update,
        actorUserId: actorId,
        actorUsername,
        actorProfilePic: profilePicUrl,
        content: getUpdateContent(update.type, actorUsername, isOwnUpdate),
      };
    }).filter(u => u !== null); // Remove null entries

    res.status(200).json({ updates: enrichedUpdates });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getUpdates };
