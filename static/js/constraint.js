export class Constraint {
    XY;
    colRow;
    coord;
    thk;
    constructor(nodeXY, nodeColRow, nodeCoord) {
        this.XY = nodeXY;
        this.colRow = nodeColRow;
        this.coord = nodeCoord;
    }
}