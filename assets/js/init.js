(function () {
  var d = document.documentElement;
  d.classList.add("js");
  var rm = false;
  try {
    rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}
  var q = location.search + location.hash;
  if (!rm && !/nointro/.test(q)) {
    d.classList.add("is-intro");
  } else {
    d.classList.add("go");
  }
  if (!/test/.test(location.search) || !/[?&]t=/.test(location.search)) {
    setTimeout(function () {
      if (d.classList.contains("is-intro")) {
        d.classList.remove("is-intro");
        d.classList.add("go");
      }
    }, 17000);
  }
})();
