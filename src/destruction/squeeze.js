function linearPart(axisX, axisY, along, across) {
  const crossX = -axisY;
  const crossY = axisX;
  return {
    xx: along * axisX * axisX + across * crossX * crossX,
    xy: along * axisX * axisY + across * crossX * crossY,
    yy: along * axisY * axisY + across * crossY * crossY,
  };
}

function affine(pivotX, pivotY, { xx, xy, yy }) {
  const shiftX = pivotX - (xx * pivotX + xy * pivotY);
  const shiftY = pivotY - (xy * pivotX + yy * pivotY);
  return {
    matrix: [xx, xy, xy, yy, shiftX, shiftY],
    map: (x, y) => [xx * x + xy * y + shiftX, xy * x + yy * y + shiftY],
  };
}

export function squeeze([pivotX, pivotY], [axisX, axisY], along, across) {
  const forward = affine(pivotX, pivotY, linearPart(axisX, axisY, along, across));
  const backward = affine(pivotX, pivotY, linearPart(axisX, axisY, 1 / along, 1 / across));
  return { matrix: forward.matrix, forward: forward.map, backward: backward.map };
}

export function squeezedBounds({ forward }, width, height) {
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => forward(x, y));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = Math.floor(Math.min(...xs));
  const top = Math.floor(Math.min(...ys));
  return { left, top, width: Math.ceil(Math.max(...xs)) - left, height: Math.ceil(Math.max(...ys)) - top };
}
