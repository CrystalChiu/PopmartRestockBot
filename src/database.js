const mongoose = require("mongoose");
const { MONGO_URI } = require("./config");

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("✅ MongoDB Connected!");
    } catch(error) {
        console.error("❌ MongoDB Connection Error:", error);
        process.exit(1);
    }
}

module.exports = { connectDB };