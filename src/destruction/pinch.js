export function pinchScale(distance, radius, strength) {
  const u = distance / radius;
  const falloff = (1 - u * u) * (1 - u * u);
  return 1 + strength * falloff;
}

export function pinchedPosition(x, y, centerX, centerY, radius, strength) {
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return [x, y];
  const scale = pinchScale(distance, radius, strength);
  return [centerX + dx / scale, centerY + dy / scale];
}
