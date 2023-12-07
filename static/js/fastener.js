export class Fastener {
    firstNode = null;
    secondNode = null;
    partNumber = null;
    type = null;
    nomDia = null;
    fastDia = null;
    holeDia = null;
    Ebb = null;
    Gb = null;
    spacing = null;
    quantity = null;

    constructor(firstNode, secondNode) {
        this.firstNode = firstNode;
        this.secondNode = secondNode;
    }
}