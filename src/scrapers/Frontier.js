class Frontier {
  constructor() {
    this.queue = [];
    this.seen = new Set();
  }

  add(url) {
    if (!this.seen.has(url)) {
      this.queue.push(url);
      this.seen.add(url);
    }
  }

  next() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

module.exports = Frontier;