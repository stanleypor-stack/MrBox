const mongoose = require("mongoose");
(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/mrbox_local");
  const U = require("../../database/models/User");
  const I = require("../../database/models/InventoryItem");
  for (const n of ["hello1", "dani", "kaylope"]) {
    const u = await U.findOne({ username: n }).lean();
    if (!u) continue;
    const todos = await I.find({ user: u._id }).select("name valueSc state").lean();
    const held = todos.filter(i => i.state === "held");
    const ag = await I.aggregate([{ $match: { user: u._id, state: "held" } }, { $group: { _id: null, cuantos: { $sum: 1 }, valor: { $sum: "$valueSc" } } }]);
    console.log(n, "| total:", todos.length, "| held:", held.length, "| estados:", [...new Set(todos.map(i=>i.state))].join(","), "| agg:", JSON.stringify(ag));
  }
  await mongoose.disconnect();
})();
