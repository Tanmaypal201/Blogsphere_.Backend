const express = require("express");
const router = express.Router();
const { uploadImageinmessage, uploadVideoInMessage, uploadDocumentInMessage } = require("../middleware/uploadfile");
const { uploadFileInMessageController } = require("../controller/uploadinmsg");
const checkauthentication = require("../middleware/auth");

router.post("/uploadimageinmessage", checkauthentication, uploadImageinmessage, uploadFileInMessageController);
router.post("/uploadvideoinmessage", checkauthentication, uploadVideoInMessage, uploadFileInMessageController);
router.post("/uploaddocumentinmessage", checkauthentication, uploadDocumentInMessage, uploadFileInMessageController);

module.exports = { router }