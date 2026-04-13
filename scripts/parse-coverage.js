const cov = require("../coverage/coverage-final.json");
const entries = Object.entries(cov);
const routes = entries.filter(function(e) { return e[0].includes("route.ts"); });
routes.forEach(function(e) {
  var path = e[0];
  var data = e[1];
  var bCov = data.b;
  var total = 0;
  var covered = 0;
  Object.values(bCov).forEach(function(counts) {
    counts.forEach(function(c) { total++; if (c > 0) covered++; });
  });
  var pct = total > 0 ? ((covered/total)*100).toFixed(1) : "100.0";
  if (pct !== "100.0") {
    console.log(pct + "% - " + path.replace(process.cwd() + "/", ""));
  }
});
