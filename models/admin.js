const mongoose = require("mongoose");

const adminSchema = mongoose.Schema({
    isDeleted: { type: Boolean, default: false },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    pincode: { type: String, default: "" },
    emergencyContact: { type: String, default: "" },
    userId: { type: String },
    role: { type: String, default: 'admin' },

    // Reset password fields
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },

}, {
    timestamps: true
});

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;