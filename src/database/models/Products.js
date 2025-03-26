const mongoose = require("mongoose");

// if we want this information we'd have to crawl each product to get it. that might be too disruptive...
// char_id: { type: mongoose.Schema.Types.ObjectId, ref: "Character" },
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true},
    in_stock: { type: Boolean, required: true }
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;