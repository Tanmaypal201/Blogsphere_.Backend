const mongoose = require("mongoose");

const updateschema = new mongoose.Schema({
    actor:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Userprofile",
        required:true,
    },
    receiver:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    type:{
        type:String,
        enum:["comment","like","profile","post","follow"],
        required:true,
    },
},{
    timestamps:true
});

const Update = mongoose.model("Update", updateschema);
module.exports = Update;