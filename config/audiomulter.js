const  multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/audio/');
    },
    filename:(req, file, cb) => {
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    },
});

const fileFilter=(req,file,cb)=>{
    if (file.mimetype.startsWith("audio")) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files allowed"), false);
  }
}

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;