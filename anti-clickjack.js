if (self === top) {
  var antiClickjack = document.getElementById('antiClickjack');
  if (antiClickjack) {
    antiClickjack.remove();
  }
} else {
  top.location = self.location;
}
