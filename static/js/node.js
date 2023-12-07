export class Node {
    XY;
    colRow;
    coord;
    thk;
    width;
    area;
    constructor(nodeXY, nodeColRow, nodeCoord) {
        this.XY = nodeXY;
        this.colRow = nodeColRow;
        this.coord = nodeCoord;
    }
}