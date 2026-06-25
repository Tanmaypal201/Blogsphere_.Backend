const { Server } = require("socket.io");
const Message = require("./models/message");
const User = require("./models/user");

let onlineUsers = new Map();

const isValidObjectId = (id) => {
  return typeof id === "string" && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
};

const normalizeUserId = (value) => {
  const str = String(value || "").trim();
  return isValidObjectId(str) ? str : null;
};

const hasValidIceCandidate = (candidate) => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  if (typeof candidate.candidate !== "string" || !candidate.candidate.trim()) {
    return false;
  }

  const hasMid = candidate.sdpMid !== null && candidate.sdpMid !== undefined;
  const hasMLine = Number.isInteger(candidate.sdpMLineIndex);
  return hasMid || hasMLine;
};

const getUnreadMessageCount = async (receiverId) => {
  const unreadSenders = await Message.distinct("sender.userId", {
    "receiver.userId": receiverId,
    status: { $ne: "seen" },
  });

  return unreadSenders.length;
};

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const callMessages = new Map();
  const callTimeouts = new Map();


  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    const removeSocketFromUser = (userId) => {
      if (!userId || !onlineUsers.has(userId)) {
        return;
      }

      const userSocket = onlineUsers.get(userId);
      userSocket.delete(socket.id);

      if (userSocket.size === 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit("userOffline", userId);
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    };

    socket.on("join", (userId) => {
      const normalizedUserId = normalizeUserId(userId);
      if (!normalizedUserId) return;
      console.log("User joined:", normalizedUserId);

      socket.userId = normalizedUserId;
      socket.join(normalizedUserId);
      if (!onlineUsers.has(normalizedUserId)) {
        onlineUsers.set(normalizedUserId, new Set());
      }
      onlineUsers.get(normalizedUserId).add(socket.id);

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
      if (onlineUsers.get(normalizedUserId).size === 1) {
        socket.broadcast.emit("userOnline", normalizedUserId);
      }
    });



    socket.on("call-user", async ({ senderId, receiverId, roomId }) => {
      const sender = normalizeUserId(senderId);
      const receiver = normalizeUserId(receiverId);
      const targetRoomId = String(roomId || "").trim();
      if (!sender || !receiver) {
        return console.log("Invalid call-user data:", { senderId, receiverId });
      }

      const senderUser = await User.findById(sender);
      const receiverUser = await User.findById(receiver);

      if (senderUser && receiverUser) {
        const newMessage = new Message({
          sender: { userId: senderUser._id, username: senderUser.username },
          receiver: { userId: receiverUser._id, username: receiverUser.username },
          content: "Ongoing",
          type: "call",
        });
        await newMessage.save();
        callMessages.set(targetRoomId, newMessage._id.toString());

        const senderSockets = onlineUsers.get(sender);
        const receiverSockets = onlineUsers.get(receiver);
        const targetSocketIds = new Set([
          ...(senderSockets ? Array.from(senderSockets) : []),
          ...(receiverSockets ? Array.from(receiverSockets) : []),
        ]);

        targetSocketIds.forEach((socketId) => {
          io.to(socketId).emit("receiveMessage", {
            messageId: newMessage._id.toString(),
            senderId: senderUser._id.toString(),
            receiverId: receiverUser._id.toString(),
            message: newMessage.content,
            createdAt: newMessage.createdAt,
            status: newMessage.status,
            type: "call",
          });
        });
      }

      const receiverSockets = onlineUsers.get(receiver);
      if (receiverSockets?.size) {
        for (const socketId of receiverSockets) {
          const payload = {
            senderId: sender,
            receiverId: receiver,
            roomId: targetRoomId,
          };

          io.to(socketId).emit("incoming-call", {
            senderId: sender,
            roomId: targetRoomId,
          });

          io.to(socketId).emit("videocall-invite", payload);
        }
      }

      // Start a 30-second timeout for missed calls
      const timeoutId = setTimeout(async () => {
        if (callMessages.has(targetRoomId)) {
          const messageId = callMessages.get(targetRoomId);
          const message = await Message.findById(messageId);
          if (message && message.content === "Ongoing") {
            message.content = "Missed Call";
            await message.save();

            const senderSockets = onlineUsers.get(sender);
            const rSockets = onlineUsers.get(receiver);
            const targetSocketIds = new Set([
              ...(senderSockets ? Array.from(senderSockets) : []),
              ...(rSockets ? Array.from(rSockets) : []),
            ]);

            targetSocketIds.forEach((socketId) => {
              io.to(socketId).emit("messageEdited", {
                messageId: messageId,
                content: "Missed Call",
                newContent: "Missed Call",
              });
            });

            // Notify clients to stop ringing UI
            if (rSockets) {
              rSockets.forEach((sId) => {
                io.to(sId).emit("call-timed-out", { roomId: targetRoomId });
              });
            }
          }
          callMessages.delete(targetRoomId);
          callTimeouts.delete(targetRoomId);
        }
      }, 30000); // 30 seconds

      callTimeouts.set(targetRoomId, timeoutId);

    });

    socket.on("accept-call", async ({ senderId, receiverId, roomId }) => {
      const sender = normalizeUserId(senderId);
      const receiver = normalizeUserId(receiverId);
      const targetRoomId = String(roomId || "").trim();
      if (!sender || !receiver || !targetRoomId) return;

      const messageId = callMessages.get(targetRoomId);
      if (callTimeouts.has(targetRoomId)) {
        clearTimeout(callTimeouts.get(targetRoomId));
        callTimeouts.delete(targetRoomId);
      }
      if (messageId) {

        const message = await Message.findById(messageId);
        if (message) {
          message.content = "Call Accepted";
          await message.save();

          const senderSockets = onlineUsers.get(sender);
          const receiverSockets = onlineUsers.get(receiver);
          const targetSocketIds = new Set([
            ...(senderSockets ? Array.from(senderSockets) : []),
            ...(receiverSockets ? Array.from(receiverSockets) : []),
          ]);

          targetSocketIds.forEach((socketId) => {
            io.to(socketId).emit("messageEdited", {
              messageId: messageId,
              content: "Call Accepted",
              newContent: "Call Accepted",
            });
          });
        }
        callMessages.delete(targetRoomId);
      }

      const senderSockets = onlineUsers.get(sender);
      const receiverSockets = onlineUsers.get(receiver);

      senderSockets?.forEach((id) => {
        io.sockets.sockets.get(id)?.join(targetRoomId);
      });

      receiverSockets?.forEach((id) => {
        io.sockets.sockets.get(id)?.join(targetRoomId);
      });

      io.to(targetRoomId).emit("call-started", {
        roomId: targetRoomId,
        senderId: sender,
        receiverId: receiver,
      });
      io.to(targetRoomId).emit("videocall-joined", {
        senderId: sender,
        receiverId: receiver,
        roomId: targetRoomId,
      });
    });

    socket.on("reject-call", async ({ senderId, receiverId, roomId }) => {
      const sender = normalizeUserId(senderId);
      const receiver = normalizeUserId(receiverId);
      const targetRoomId = String(roomId || "").trim();
      if (!sender || !receiver) return;

      const messageId = callMessages.get(targetRoomId);
      if (callTimeouts.has(targetRoomId)) {
        clearTimeout(callTimeouts.get(targetRoomId));
        callTimeouts.delete(targetRoomId);
      }
      if (messageId) {

        const message = await Message.findById(messageId);
        if (message) {
          message.content = "Call Rejected";
          await message.save();

          const senderSockets = onlineUsers.get(sender);
          const receiverSockets = onlineUsers.get(receiver);
          const targetSocketIds = new Set([
            ...(senderSockets ? Array.from(senderSockets) : []),
            ...(receiverSockets ? Array.from(receiverSockets) : []),
          ]);

          targetSocketIds.forEach((socketId) => {
            io.to(socketId).emit("messageEdited", {
              messageId: messageId,
              content: "Call Rejected",
              newContent: "Call Rejected",
            });
          });
        }
        callMessages.delete(targetRoomId);
      }

      const senderSockets = onlineUsers.get(sender);
      senderSockets?.forEach((id) => {
        io.to(id).emit("call-rejected", {
          senderId: receiver,
          receiverId: sender,
          roomId: targetRoomId,
        });
      });
    });

    socket.on("join-room", ({ roomId }, ack) => {
      const targetRoomId = String(roomId || "").trim();
      if (!targetRoomId) {
        if (typeof ack === "function") {
          ack({ ok: false, error: "invalid-room" });
        }
        return;
      }

      if (socket.currentRoom && socket.currentRoom !== targetRoomId) {
        socket.leave(socket.currentRoom);
      }

      socket.join(targetRoomId);
      socket.currentRoom = targetRoomId;

      const participants =
        io.sockets.adapter.rooms.get(targetRoomId)?.size || 0;
      if (typeof ack === "function") {
        ack({ ok: true, roomId: targetRoomId, participants });
      }

      socket.to(targetRoomId).emit("room-peer-joined", {
        roomId: targetRoomId,
        participants,
      });
    });

    socket.on("leave-room", ({ roomId }) => {
      const targetRoomId = String(roomId || "").trim();
      if (!targetRoomId) return;

      if (socket.currentRoom === targetRoomId) {
        socket.leave(targetRoomId);
        socket.currentRoom = null;
      }
    });

    socket.on("call-offer", ({ roomId, offer }) => {
      const targetRoomId = String(roomId || "").trim();
      if (!targetRoomId || !offer) {
        return;
      }

      socket.to(targetRoomId).emit("call-offer", {
        from: normalizeUserId(socket.userId),
        offer,
      });
    });

    socket.on("call-answer", ({ roomId, answer }) => {
      const targetRoomId = String(roomId || "").trim();
      if (!targetRoomId || !answer) {
        return;
      }

      socket.to(targetRoomId).emit("call-answer", {
        from: normalizeUserId(socket.userId),
        answer,
      });
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
      const targetRoomId = String(roomId || "").trim();
      if (!targetRoomId || !hasValidIceCandidate(candidate)) {
        return;
      }
      socket.to(targetRoomId).emit("ice-candidate", { candidate });
    });

    socket.on("end-call", ({ roomId }) => {
      const targetRoomId = String(roomId || "").trim();
      if (!targetRoomId) return;
      io.to(targetRoomId).emit("call-ended", { roomId: targetRoomId });
      io.in(targetRoomId).socketsLeave(targetRoomId);
    });

    socket.on("leave", (userId) => {
      const targetUserId = normalizeUserId(userId || socket.userId);
      removeSocketFromUser(targetUserId);
      if (socket.userId === targetUserId) {
        socket.userId = undefined;
      }
    });

    socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);

      console.log("Send message attempt:", {
        senderId: targetSenderId,
        receiverId: targetReceiverId,
        messageLength: message?.length || 0,
      });

      if (!targetSenderId || !targetReceiverId || !message?.trim()) {
        return;
      }

      const receiverSockets = onlineUsers.get(targetReceiverId);
      const senderUser = await User.findById(targetSenderId);
      const receiverUser = await User.findById(targetReceiverId);

      if (!senderUser || !receiverUser) {
        console.log("Message users not found:", {
          senderId: targetSenderId,
          receiverId: targetReceiverId,
        });
        return;
      }

      const newMessage = new Message({
        sender: {
          userId: senderUser._id,
          username: senderUser.username,
        },
        receiver: {
          userId: receiverUser._id,
          username: receiverUser.username,
        },
        content: message,
        type: "text",
      });

      await newMessage.save();

      const senderSockets = onlineUsers.get(targetSenderId);
      const targetSocketIds = new Set([
        ...(receiverSockets ? Array.from(receiverSockets) : []),
        ...(senderSockets ? Array.from(senderSockets) : []),
      ]);

      if (targetSocketIds.size) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit("receiveMessage", {
            messageId: newMessage._id.toString(),
            senderId: senderUser._id.toString(),
            receiverId: receiverUser._id.toString(),
            message,
            createdAt: newMessage.createdAt,
            status: newMessage.status,
            seenAt: newMessage.seenAt || null,
            type: "text",
          });
        }
      }

      const unreadCount = await getUnreadMessageCount(targetReceiverId);
      io.to(targetReceiverId).emit("msgnotification", {
        senderId: targetSenderId,
        unreadCount,
      });
    });

    socket.on("sendFileMessage", async ({
      senderId,
      receiverId,
      fileUrl,
      fileName,
      fileSize,
      type,
      caption,
      clientTempId,
    }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      const normalizedType = String(type || "").trim();
      const normalizedFileUrl = String(fileUrl || "").trim();
      const normalizedFileName = String(fileName || "").trim();
      const normalizedCaption = String(caption || "").trim();
      const normalizedFileSize = Number(fileSize || 0);

      if (!targetSenderId || !targetReceiverId || !normalizedFileUrl) {
        return;
      }

      if (!["image", "video", "document"].includes(normalizedType)) {
        return;
      }

      const receiverSockets = onlineUsers.get(targetReceiverId);
      const senderUser = await User.findById(targetSenderId);
      const receiverUser = await User.findById(targetReceiverId);

      if (!senderUser || !receiverUser) {
        return;
      }

      const newMessage = new Message({
        sender: {
          userId: senderUser._id,
          username: senderUser.username,
        },
        receiver: {
          userId: receiverUser._id,
          username: receiverUser.username,
        },
        content: normalizedCaption || normalizedFileName || "Sent a file",
        type: normalizedType,
        fileUrl: normalizedFileUrl,
        fileName: normalizedFileName,
        fileSize: Number.isFinite(normalizedFileSize) ? normalizedFileSize : 0,
      });

      await newMessage.save();

      const senderSockets = onlineUsers.get(targetSenderId);
      const targetSocketIds = new Set([
        ...(receiverSockets ? Array.from(receiverSockets) : []),
        ...(senderSockets ? Array.from(senderSockets) : []),
      ]);

      if (targetSocketIds.size) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit("receiveMessage", {
            messageId: newMessage._id.toString(),
            senderId: senderUser._id.toString(),
            receiverId: receiverUser._id.toString(),
            message: newMessage.content,
            createdAt: newMessage.createdAt,
            status: newMessage.status,
            seenAt: newMessage.seenAt || null,
            type: normalizedType,
            fileUrl: normalizedFileUrl,
            fileName: normalizedFileName,
            fileSize: Number.isFinite(normalizedFileSize)
              ? normalizedFileSize
              : 0,
            clientTempId: String(clientTempId || "").trim(),
          });
        }
      }

      const unreadCount = await getUnreadMessageCount(targetReceiverId);
      io.to(targetReceiverId).emit("msgnotification", {
        senderId: targetSenderId,
        unreadCount,
      });
    });

    //React to the Message!!
    socket.on("reactMessage", async ({ messageId, senderId, receiverId, emoji }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      if (!targetSenderId || !targetReceiverId || !messageId || !emoji) {
        return;
      }
      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }
      const existingReactionIndex = message.reactions.findIndex((r) => {
        const reactionUserId = String(r?.userId || "").trim();
        const reactionEmoji = String(r?.emoji || "").trim();
        return reactionUserId === targetSenderId && reactionEmoji === emoji;
      });
      if (existingReactionIndex !== -1) {
        message.reactions.splice(existingReactionIndex, 1);
      }
      else {
        message.reactions.push({
          userId: targetSenderId,
          emoji,
        });
      }
      await message.save();

      const normalizedReactions = (message.reactions || []).map((r) => ({
        userId: String(r.userId || ""),
        emoji: String(r.emoji || ""),
      }));

      const receiverSockets = onlineUsers.get(targetReceiverId);
      const senderSockets = onlineUsers.get(targetSenderId);
      const targetSocketIds = new Set([
        ...(receiverSockets ? Array.from(receiverSockets) : []),
        ...(senderSockets ? Array.from(senderSockets) : []),
      ]);

      if (targetSocketIds.size) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit("messageReaction", {
            messageId,
            reactions: normalizedReactions,
          });
        }
      }
    });

    //Reply to a Message!!
    socket.on("replyMessage", async ({ senderId, receiverId, message, replyTo }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      if (!targetSenderId || !targetReceiverId || !message?.trim() || !replyTo) {
        return;
      }
      const receiverSockets = onlineUsers.get(targetReceiverId);
      const senderSockets = onlineUsers.get(targetSenderId);
      const senderUser = await User.findById(targetSenderId);
      const receiverUser = await User.findById(targetReceiverId);
      if (!senderUser || !receiverUser) {
        return;
      }

      const normalizedReplyTo = {
        messageId: String(replyTo?.messageId || "").trim(),
        senderId: String(replyTo?.senderId || "").trim(),
        type: String(replyTo?.type || "text").trim() || "text",
        content: String(replyTo?.content || "").trim(),
      };

      if (!normalizedReplyTo.messageId || !normalizedReplyTo.content) {
        return;
      }

      const newMessage = new Message({
        sender: {
          userId: senderUser._id,
          username: senderUser.username,
        },
        receiver: {
          userId: receiverUser._id,
          username: receiverUser.username,
        },
        content: message,
        type: "text",
        replyTo: normalizedReplyTo,
      });
      await newMessage.save();

      const targetSocketIds = new Set([
        ...(receiverSockets ? Array.from(receiverSockets) : []),
        ...(senderSockets ? Array.from(senderSockets) : []),
      ]);

      if (targetSocketIds.size) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit("receiveMessage", {
            messageId: newMessage._id.toString(),
            senderId: senderUser._id.toString(),
            receiverId: receiverUser._id.toString(),
            message,
            createdAt: newMessage.createdAt,
            status: newMessage.status,
            seenAt: newMessage.seenAt || null,
            type: "text",
            replyTo: normalizedReplyTo,
          });
        }
      }

      const unreadCount = await getUnreadMessageCount(targetReceiverId);
      io.to(targetReceiverId).emit("msgnotification", {
        senderId: targetSenderId,
        unreadCount,
      });
    });

    //Deleting A Message!!
    socket.on("deleteMessage", async ({ messageId, senderId, receiverId }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      if (!targetSenderId || !targetReceiverId || !messageId) {
        return;
      }
      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }
      if (message.sender.userId.toString() !== targetSenderId) {
        return;
      }
      await Message.findByIdAndDelete(messageId);
      const receiverSockets = onlineUsers.get(
        message.receiver.userId.toString(),
      );
      if (receiverSockets?.size) {
        for (const socketId of receiverSockets) {
          io.to(socketId).emit("messageDeleted", {
            messageId,
            by: targetSenderId,
          });
        }
      }
    });
    //Edit message!! 
    socket.on("editMessage", async ({ messageId, senderId, receiverId, newContent }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      if (!targetSenderId || !targetReceiverId || !messageId || !newContent?.trim()) {
        return;
      }
      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }
      if (message.sender.userId.toString() !== targetSenderId) {
        return;
      }
      const updatedContent = String(newContent || "").trim();
      message.content = updatedContent;
      message.editedAt = new Date();
      await message.save();

      const receiverSockets = onlineUsers.get(targetReceiverId);
      const senderSockets = onlineUsers.get(targetSenderId);
      const targetSocketIds = new Set([
        ...(receiverSockets ? Array.from(receiverSockets) : []),
        ...(senderSockets ? Array.from(senderSockets) : []),
      ]);

      if (targetSocketIds.size) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit("messageEdited", {
            messageId,
            content: updatedContent,
            newContent: updatedContent,
          });
        }
      }
    });

    socket.on("typing", ({ senderId, receiverId, replyPreview }) => {
      const receiverSockets = onlineUsers.get(normalizeUserId(receiverId));
      const normalizedSenderId = normalizeUserId(senderId || socket.userId);
      if (receiverSockets?.size) {
        for (const socketId of receiverSockets) {
          io.to(socketId).emit("typing", {
            senderId: normalizedSenderId,
            replyPreview: String(replyPreview || ""),
          });
        }
      }
    });

    socket.on("markAsSeen", async ({ senderId }) => {
      try {
        const currentUserId = normalizeUserId(socket.userId);
        const normalizedSenderId = normalizeUserId(senderId);
        if (!normalizedSenderId || !currentUserId) {
          return;
        }

        await Message.updateMany(
          {
            "sender.userId": normalizedSenderId,
            "receiver.userId": currentUserId,
            status: { $ne: "seen" },
          },
          { $set: { status: "seen", seenAt: new Date() } },
        );

        const unreadCount = await getUnreadMessageCount(currentUserId);
        io.to(currentUserId).emit("msgnotification", {
          senderId: normalizedSenderId,
          unreadCount,
        });

        const senderSockets = onlineUsers.get(normalizedSenderId);
        if (senderSockets) {
          senderSockets.forEach((id) => {
            io.to(id).emit("messagesSeen", {
              by: currentUserId,
              conversationWith: normalizedSenderId,
            });
          });
        }
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("sendAudio", async ({ senderId, receiverId, audioUrl }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      console.log("Send audio message attempt:", {
        senderId: targetSenderId,
        receiverId: targetReceiverId,
        audioUrl,
      });
      if (!targetSenderId || !targetReceiverId || !audioUrl) {
        return console.log("Invalid audio message data:", {
          senderId,
          receiverId,
          audioUrl,
        });
      }

      const newaudioMessage = new Message({
        sender: {
          userId: targetSenderId,
          username:
            (await User.findById(targetSenderId))?.username || "Unknown",
        },
        receiver: {
          userId: targetReceiverId,
          username:
            (await User.findById(targetReceiverId))?.username || "Unknown",
        },
        content: audioUrl,
        type: "audio",
      });
      await newaudioMessage.save();
      const receiverSockets = onlineUsers.get(targetReceiverId);
      const senderSockets = onlineUsers.get(targetSenderId);
      const targetSocketIds = new Set([
        ...(receiverSockets ? Array.from(receiverSockets) : []),
        ...(senderSockets ? Array.from(senderSockets) : []),
      ]);

      if (targetSocketIds.size) {
        for (const socketId of targetSocketIds) {
          io.to(socketId).emit("receiveMessage", {
            messageId: newaudioMessage._id.toString(),
            senderId: targetSenderId,
            receiverId: targetReceiverId,
            message: audioUrl,
            createdAt: newaudioMessage.createdAt,
            status: newaudioMessage.status,
            seenAt: newaudioMessage.seenAt || null,
            type: "audio",
          });
        }
      }

      const unreadCount = await getUnreadMessageCount(targetReceiverId);
      io.to(targetReceiverId).emit("msgnotification", {
        senderId: targetSenderId,
        unreadCount,
      });
    });

    //Socket For new message
    socket.on("newmessage", async ({ senderId, receiverId, reciverId }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId || reciverId);
      if (!targetReceiverId || !targetSenderId) {
        return;
      }
      const newmessages = await Message.find({
        "sender.userId": targetSenderId,
        "receiver.userId": targetReceiverId,
        status: { $ne: "seen" },
      });

      if (newmessages.length === 1) {
        const receiverSockets = onlineUsers.get(targetReceiverId);
        if (receiverSockets?.size) {
          for (const socketId of receiverSockets) {
            io.to(socketId).emit("taptoseen", {
              receiverId: targetReceiverId,
              senderId: targetSenderId,
              message: newmessages[0].content,
              totalnewmessages: 1,
            });
          }
        }
      } else if (newmessages.length > 1) {
        const receiverSockets = onlineUsers.get(targetReceiverId);
        if (receiverSockets?.size) {
          for (const socketId of receiverSockets) {
            io.to(socketId).emit("taptoseen", {
              receiverId: targetReceiverId,
              senderId: targetSenderId,
              message: "",
              totalnewmessages: newmessages.length,
            });
          }
        }
      }
    });

    //Notifiacation to the user for Message
    socket.on("newMsgNotification", async ({ senderId, receiverId }) => {
      const targetSenderId = normalizeUserId(senderId);
      const targetReceiverId = normalizeUserId(receiverId);
      if (!targetReceiverId || !targetSenderId) {
        return;
      }
      const unreadCount = await getUnreadMessageCount(targetReceiverId);

      io.to(targetReceiverId).emit("msgnotification", {
        senderId: targetSenderId,
        unreadCount,
      });
    });

    socket.on("disconnect", () => {
      const userId = socket.userId;

      if (socket.currentRoom) {
        console.log("[socket] leaving room on disconnect", {
          socketId: socket.id,
          roomId: socket.currentRoom,
        });
        socket.leave(socket.currentRoom);
        socket.currentRoom = null;
      }

      removeSocketFromUser(userId);
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = { initializeSocket };
