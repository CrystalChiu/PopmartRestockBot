const mongoose = require("mongoose");

const productTypeSchema = new mongoose.Schema({
    name: { type: String },
    ranking: { type: Number }
});

const ProductType = mongoose.model("ProductType", productTypeSchema);

module.exports = ProductType;